import { NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";
import { apiError, readJsonObject, toUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import type { AuthResponse, RegisterRequest, UserRole } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns per-field errors for a register body, or the cleaned request if valid. */
function validate(body: Record<string, unknown>): { fieldErrors: Record<string, string> } | { data: RegisterRequest } {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === undefined ? "SEEKER" : body.role;
  const fieldErrors: Record<string, string> = {};

  if (!EMAIL_PATTERN.test(email)) fieldErrors.email = "Enter a valid email address";
  if (!name) fieldErrors.name = "Name is required";
  else if (name.length > 100) fieldErrors.name = "Name must be 100 characters or fewer";
  if (password.length < 8) fieldErrors.password = "Password must be at least 8 characters";
  else if (Buffer.byteLength(password) > 72) fieldErrors.password = "Password must be 72 bytes or fewer";
  if (role !== "SEEKER" && role !== "EMPLOYER") fieldErrors.role = 'Choose "SEEKER" or "EMPLOYER"';

  return Object.keys(fieldErrors).length
    ? { fieldErrors }
    : { data: { email, name, password, role: role as UserRole } };
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const result = validate(body);
  if ("fieldErrors" in result) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", result.fieldErrors);
  }
  const { email, name, password, role } = result.data;

  try {
    const user = await prisma.user.create({
      data: { email, name, role, passwordHash: await hashPassword(password) },
    });
    const response = NextResponse.json<AuthResponse>({ user: toUser(user) }, { status: 201 });
    await createSession(response, user.id);
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(409, "EMAIL_TAKEN", "An account with this email already exists", {
        email: "Already registered",
      });
    }
    console.error("register failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
