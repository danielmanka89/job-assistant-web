import { NextResponse } from "next/server";
import { AiError } from "@/lib/ai";
import type {
  GeneratedFile as GeneratedFileRow,
  JobPosting as JobPostingRow,
  Resume as ResumeRow,
  Submission as SubmissionRow,
  TailoredResume as TailoredResumeRow,
  User as UserRow,
} from "@/lib/generated/prisma/client";
import {
  THEME_COLORS,
  CLOCK_TEMPLATES,
  type ApiError,
  type ThemeColor,
  type ClockTemplate,
  type Education,
  type GeneratedFile,
  type JobPosting,
  type JobSource,
  type Resume,
  type ResumeContact,
  type SheetValues,
  type Submission,
  type TailoredResume,
  type User,
  type UserRole,
  type WorkExperience,
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

// Same limits as the job description field in the UI.
const MIN_JD_CHARS = 50;
const MAX_JD_CHARS = 20_000;

/** Returns a field error for a pasted job description, or undefined if it's usable. */
export function jobDescriptionError(jobDescription: string): string | undefined {
  if (!jobDescription) return "Paste a job description to analyze.";
  if (jobDescription.length < MIN_JD_CHARS) {
    return `That looks too short. Paste the full job description (at least ${MIN_JD_CHARS} characters).`;
  }
  if (jobDescription.length > MAX_JD_CHARS) {
    return `Job descriptions can be at most ${MAX_JD_CHARS.toLocaleString("en-US")} characters.`;
  }
  return undefined;
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
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    clockTemplate: CLOCK_TEMPLATES.includes(row.clockTemplate as ClockTemplate) ? (row.clockTemplate as ClockTemplate) : "MINIMALIST",
    themeColor: THEME_COLORS.includes(row.themeColor as ThemeColor) ? (row.themeColor as ThemeColor) : "RED",
    createdAt: row.createdAt.toISOString(),
  };
}

/** Maps a database resume to the Resume type. */
export function toResume(row: Omit<ResumeRow, "data">): Resume {
  return {
    id: row.id,
    userId: row.userId,
    ...(row.sourceFileName ? { sourceFileName: row.sourceFileName } : {}),
    contact: row.contact as unknown as ResumeContact,
    ...(row.summary ? { summary: row.summary } : {}),
    workExperience: row.workExperience as unknown as WorkExperience[],
    education: row.education as unknown as Education[],
    skills: row.skills as unknown as string[],
    ...(Array.isArray(row.certifications) && row.certifications.length ? { certifications: row.certifications as string[] } : {}),
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
    finalMatchPercent: row.finalMatchPercent,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Maps a database job to the JobPosting type (drops externalId and postedById). */
export function toJobPosting(row: JobPostingRow): JobPosting {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    description: row.description,
    applyUrl: row.applyUrl,
    source: row.source as JobSource,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Maps a database generated file to the GeneratedFile type; downloads go through GET /api/files/:id. */
export function toGeneratedFile(row: Omit<GeneratedFileRow, "data">, sourceResumeId: string): GeneratedFile {
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

/** Maps a database submission to the Submission type. */
export function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    jobId: row.jobPostingId,
    vendor: row.vendor as SheetValues,
    submission: row.submission as SheetValues,
    skills: row.skills as SheetValues,
    client: row.client as SheetValues,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
