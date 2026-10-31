import { NextResponse } from "next/server";
import type { User as UserRow, Resume as ResumeRow } from "@/lib/generated/prisma/client";
import type { ApiError, Education, Resume, ResumeContact, User, WorkExperience } from "@/lib/types";

/** Builds a JSON error response that conforms to ApiError. */
export function apiError(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): NextResponse<ApiError> {
  const body: ApiError = fieldErrors ? { code, message, fieldErrors } : { code, message };
  return NextResponse.json(body, { status });
}

/** Parses a JSON request body, or returns null if it is not a JSON object. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Maps a database user to the public User type (drops passwordHash). */
export function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.createdAt.toISOString() };
}

/** Maps a database resume to the Resume type. */
export function toResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    userId: row.userId,
    ...(row.sourceFileName ? { sourceFileName: row.sourceFileName } : {}),
    contact: row.contact as unknown as ResumeContact,
    ...(row.summary ? { summary: row.summary } : {}),
    workExperience: row.workExperience as unknown as WorkExperience[],
    education: row.education as unknown as Education[],
    skills: row.skills as unknown as string[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
