import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORMATS, ResumeChangedError, createTailoredResume, type Format } from "@/lib/tailoring";
import type { SuggestedBullet, TailoredResumeResponse } from "@/lib/types";

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * POST /api/tailor — merges the accepted suggestions from a gap analysis into the resume (with the
 * user's saved profile applied: its contact details and skills),
 * stores the TailoredResume, and renders the requested .docx / .pdf files.
 * The job description comes from the stored analysis; a jobDescription in the body is ignored.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to create a tailored resume");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const resumeId = typeof body.resumeId === "string" ? body.resumeId : "";
  const gapAnalysisId = typeof body.gapAnalysisId === "string" ? body.gapAnalysisId : "";
  const fieldErrors: Record<string, string> = {};
  if (!resumeId) fieldErrors.resumeId = "Required";
  if (!gapAnalysisId) fieldErrors.gapAnalysisId = "Required";
  if (!isStringArray(body.acceptedBulletIds)) fieldErrors.acceptedBulletIds = "Must be a list of suggestion ids";
  const formats = isStringArray(body.formats) ? [...new Set(body.formats)] : [];
  if (!formats.length || formats.some((f) => !(f in FORMATS))) fieldErrors.formats = 'Choose "docx", "pdf" or both';
  if (Object.keys(fieldErrors).length) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);
  }
  const acceptedBulletIds = [...new Set(body.acceptedBulletIds as string[])];

  const analysis = await prisma.gapAnalysis.findFirst({ where: { id: gapAnalysisId, userId: user.id } });
  if (!analysis) return apiError(404, "ANALYSIS_NOT_FOUND", "Gap analysis not found");
  if (analysis.resumeId !== resumeId) {
    return apiError(400, "VALIDATION_ERROR", "This analysis was made for a different resume", {
      resumeId: "Doesn't match the gap analysis",
    });
  }
  const resumeRow = await prisma.resume.findFirst({ where: { id: resumeId, userId: user.id } });
  if (!resumeRow) return apiError(404, "RESUME_NOT_FOUND", "Resume not found");

  // Only suggestions from this analysis can be accepted; their text comes from the database.
  const suggestions = analysis.suggestedBullets as unknown as SuggestedBullet[];
  const unknownIds = acceptedBulletIds.filter((id) => !suggestions.some((s) => s.id === id));
  if (unknownIds.length) {
    return apiError(400, "VALIDATION_ERROR", "Some selected suggestions aren't part of this analysis", {
      acceptedBulletIds: `Unknown suggestion ids: ${unknownIds.join(", ")}`,
    });
  }

  try {
    const response = await createTailoredResume(user.id, resumeRow, analysis, acceptedBulletIds, formats as Format[]);
    return NextResponse.json<TailoredResumeResponse>(response, { status: 201 });
  } catch (error) {
    if (error instanceof ResumeChangedError) {
      return apiError(409, "RESUME_CHANGED", "Your resume was edited after this analysis. Run the analysis again.");
    }
    console.error("tailored resume generation failed", error);
    return apiError(500, "GENERATION_FAILED", "We couldn't create your resume files. Please try again.");
  }
}
