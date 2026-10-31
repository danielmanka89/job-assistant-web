import { NextResponse } from "next/server";
import { apiError, readJsonObject, toUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fieldErrors: Record<string, string> = {};
  if (!email) fieldErrors.email = "Email is required";
  if (!password) fieldErrors.password = "Password is required";
  if (Object.keys(fieldErrors).length) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    dummyHash ??= hashPassword("timing-equalizer");
    const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
    if (!user || !valid) return apiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");

    const response = NextResponse.json<AuthResponse>({ user: toUser(user) });
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error("login failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
