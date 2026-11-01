import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncProfileToResume } from "@/lib/profile";
import { recentJobDescriptions } from "@/lib/learning-store";
import { marketReach } from "@/lib/market-reach";
import { checkResumeSync } from "@/lib/resume-sync-token";
import { FILE_TYPES, readResumeUpload } from "@/lib/resume-upload";
import type { ProfileValues, ResumeDraft, ResumeSyncResponse } from "@/lib/types";

/**
 * POST /api/resume/confirm-sync — saves the resume and updates the profile to match it, in one
 * transaction. Multipart fields: "file" (the same file sent to /api/resume/compare), "draft" (its
 * draft as JSON) and "syncToken". The draft is saved as compared, without parsing the file again.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to upload a resume");

  const upload = await readResumeUpload(request);
  if ("error" in upload) return upload.error;

  const token = upload.form.get("syncToken");
  let draft: ResumeDraft | null = null;
  try {
    const raw = upload.form.get("draft");
    draft = typeof raw === "string" ? (JSON.parse(raw) as ResumeDraft) : null;
  } catch {
    draft = null;
  }
  if (typeof token !== "string" || !draft || typeof draft !== "object") {
    return apiError(400, "VALIDATION_ERROR", "Send the file with the draft and syncToken from /api/resume/compare", {
      ...(typeof token !== "string" ? { syncToken: "Required" } : {}),
      ...(!draft ? { draft: "Must be the draft JSON from /api/resume/compare" } : {}),
    });
  }

  const check = checkResumeSync(token, user.id, upload.file.bytes, draft);
  if (check === "expired") return apiError(410, "SYNC_EXPIRED", "This comparison is over an hour old. Upload the resume again.");
  if (check === "mismatch") {
    return apiError(400, "SYNC_MISMATCH", "The file or details don't match what was compared. Upload the resume again.");
  }

  // Market Reach when the resume is added: the baseline the Learning dashboard compares against.
  const baseline = marketReach(draft, await recentJobDescriptions()).percent;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.candidateProfile.findUnique({ where: { userId: user.id } });
      const { values, changes } = syncProfileToResume((existing?.values as ProfileValues | undefined) ?? {}, draft);
      const resume = await tx.resume.create({
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
          ...(draft.certifications?.length ? { certifications: draft.certifications } : {}),
          marketReachPercent: baseline,
        },
        omit: { data: true },
      });
      const profile = await tx.candidateProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, values },
        update: { values },
      });
      return { resume, profile, values, changes };
    });
    return NextResponse.json<ResumeSyncResponse>(
      {
        resume: toResume(result.resume),
        profile: { values: result.values, updatedAt: result.profile.updatedAt.toISOString(), resume: toResume(result.resume) },
        changes: result.changes,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("resume sync failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Nothing was saved; please try again.");
  }
}
