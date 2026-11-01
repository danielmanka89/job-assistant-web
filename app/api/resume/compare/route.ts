import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { syncProfileToResume } from "@/lib/profile";
import { getProfileValues } from "@/lib/profile-store";
import { signResumeSync } from "@/lib/resume-sync-token";
import { parseResumeUpload, readResumeUpload } from "@/lib/resume-upload";
import type { ResumeCompareResponse } from "@/lib/types";

/**
 * POST /api/resume/compare — reads an uploaded resume (multipart, field "file") and lists how it
 * would change the profile. Nothing is saved; send the same file with the returned draft and
 * syncToken to POST /api/resume/confirm-sync to save both.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to upload a resume");

  const upload = await readResumeUpload(request);
  if ("error" in upload) return upload.error;
  const parsed = await parseResumeUpload(upload.file, user);
  if ("error" in parsed) return parsed.error;

  const { changes } = syncProfileToResume(await getProfileValues(user.id), parsed.draft);
  return NextResponse.json<ResumeCompareResponse>({
    draft: parsed.draft,
    changes,
    syncToken: signResumeSync(user.id, upload.file.bytes, parsed.draft),
  });
}
