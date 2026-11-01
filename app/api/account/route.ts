import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";
import { emailError, nameError, normalizeEmail, passwordError } from "@/lib/account-validation";
import { apiError, readJsonObject, toUser } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, deleteOtherSessions } from "@/lib/session";
import type { AccountResponse } from "@/lib/types";

/** GET /api/account — the logged-in user, fresh from the database. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your settings");
  return NextResponse.json<AccountResponse>({ user: toUser(user) });
}

/**
 * PATCH /api/account — updates name, email and/or password (see UpdateAccountRequest).
 * Email and password changes need the current password; a new password signs out every other session.
 */
export async function PATCH(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to change your settings");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const fieldErrors: Record<string, string> = {};
  const data: Prisma.UserUpdateInput = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const error = nameError(name);
    if (error) fieldErrors.name = error;
    else if (name !== user.name) data.name = name;
  }
  if (body.email !== undefined) {
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const error = emailError(email);
    if (error) fieldErrors.email = error;
    else if (email !== user.email) data.email = email;
  }
  const newPassword = body.newPassword === undefined ? undefined : typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword !== undefined) {
    const error = passwordError(newPassword);
    if (error) fieldErrors.newPassword = error;
  }
  if (Object.keys(fieldErrors).length) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);
  }

  // Someone with a stolen session shouldn't be able to take over the account.
  if (data.email !== undefined || newPassword !== undefined) {
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    if (!currentPassword) {
      return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", {
        currentPassword: "Enter your current password to confirm this change",
      });
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return apiError(403, "INVALID_PASSWORD", "Your current password is incorrect", {
        currentPassword: "Current password is incorrect",
      });
    }
  }
  if (newPassword !== undefined) data.passwordHash = await hashPassword(newPassword);

  if (!Object.keys(data).length) return NextResponse.json<AccountResponse>({ user: toUser(user) });

  try {
    const updated = await prisma.user.update({ where: { id: user.id }, data });
    if (newPassword !== undefined) await deleteOtherSessions(user.id, request.cookies.get(SESSION_COOKIE)?.value);
    return NextResponse.json<AccountResponse>({ user: toUser(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(409, "EMAIL_TAKEN", "An account with this email already exists", {
        email: "Already registered",
      });
    }
    console.error("account update failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
