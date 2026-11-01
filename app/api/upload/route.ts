import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FILE_TYPES, parseResumeUpload, readResumeUpload } from "@/lib/resume-upload";
import type { Resume } from "@/lib/types";

/**
 * POST /api/upload — parses and saves a resume without touching the profile.
 * The upload page uses /api/resume/compare and /api/resume/confirm-sync instead.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to upload a resume");

  const upload = await readResumeUpload(request);
  if ("error" in upload) return upload.error;
  const parsed = await parseResumeUpload(upload.file, user);
  if ("error" in parsed) return parsed.error;
  const { draft } = parsed;

  try {
    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        sourceFileName: upload.file.name,
        storedFileName: `${randomUUID()}.${upload.file.fileType}`,
        mimeType: FILE_TYPES[upload.file.fileType].mimeType,
        fileSize: upload.file.bytes.length,
        data: new Uint8Array(upload.file.bytes),
        contact: { ...draft.contact },
        summary: draft.summary ?? null,
        workExperience: draft.workExperience as object[],
        education: draft.education as object[],
        skills: draft.skills,
      },
    });
    return NextResponse.json<Resume>(toResume(resume), { status: 201 });
  } catch (error) {
    console.error("upload failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
