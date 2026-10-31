import { NextResponse } from "next/server";
import { AiError } from "@/lib/ai";
import type {
  GeneratedFile as GeneratedFileRow,
  Resume as ResumeRow,
  TailoredResume as TailoredResumeRow,
  User as UserRow,
} from "@/lib/generated/prisma/client";
import type {
  ApiError,
  Education,
  GeneratedFile,
  Resume,
  ResumeContact,
  TailoredResume,
  User,
  WorkExperience,
} from "@/lib/types";

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

/** Maps a failed AI call to an ApiError response; `unreadable` covers declined or unusable model output. */
export function aiErrorResponse(error: unknown, unreadable: { code: string; message: string }): NextResponse<ApiError> {
  if (error instanceof AiError && error.reason === "unreadable") return apiError(422, unreadable.code, unreadable.message);
  if (error instanceof AiError && error.reason === "not_configured") {
    return apiError(503, "AI_NOT_CONFIGURED", "The AI service isn't set up on this server yet.");
  }
  return apiError(502, "AI_UNAVAILABLE", "The AI service is temporarily unavailable. Please try again.");
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

/** Maps a database tailored resume to the TailoredResume type. */
export function toTailoredResume(row: TailoredResumeRow): TailoredResume {
  return {
    id: row.id,
    userId: row.userId,
    sourceResumeId: row.sourceResumeId,
    gapAnalysisId: row.gapAnalysisId,
    acceptedBulletIds: row.acceptedBulletIds as unknown as string[],
    contact: row.contact as unknown as ResumeContact,
    ...(row.summary ? { summary: row.summary } : {}),
    workExperience: row.workExperience as unknown as WorkExperience[],
    education: row.education as unknown as Education[],
    skills: row.skills as unknown as string[],
    createdAt: row.createdAt.toISOString(),
  };
}

/** Maps a database generated file to the GeneratedFile type; downloads go through GET /api/files/:id. */
export function toGeneratedFile(row: GeneratedFileRow, sourceResumeId: string): GeneratedFile {
  return {
    id: row.id,
    resumeId: sourceResumeId,
    tailoredResumeId: row.tailoredResumeId,
    format: row.format as GeneratedFile["format"],
    fileName: row.fileName,
    downloadUrl: `/api/files/${row.id}`,
    createdAt: row.createdAt.toISOString(),
  };
}
