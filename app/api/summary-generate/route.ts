import { NextResponse, type NextRequest } from "next/server";
import { generateSummaryOptions } from "@/lib/ai";
import { aiErrorResponse, apiError, jobDescriptionError, readJsonObject, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withAddedSkills } from "@/lib/skills";
import type { SummaryGenerateResponse } from "@/lib/types";

/**
 * POST /api/summary-generate — writes three summary options for one of the user's resumes
 * and a pasted job description. Nothing is saved; PATCH /api/resumes/:id/summary stores the pick.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to generate a summary");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const resumeId = typeof body.resumeId === "string" ? body.resumeId.trim() : "";
  const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  const fieldErrors: Record<string, string> = {};
  if (!resumeId) fieldErrors.resumeId = "Required";
  const jdError = jobDescriptionError(jobDescription);
  if (jdError) fieldErrors.jobDescription = jdError;
  if (Object.keys(fieldErrors).length) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);
  }

  const row = await prisma.resume.findFirst({ where: { id: resumeId, userId: user.id } });
  if (!row) return apiError(404, "RESUME_NOT_FOUND", "Resume not found");
  const resume = toResume(row);

  // Reuse the latest gap analysis for this job, counting skills added since it ran.
  const analysis = await prisma.gapAnalysis.findFirst({
    where: { userId: user.id, resumeId, jobDescription },
    orderBy: { createdAt: "desc" },
    select: { matchedKeywords: true, missingKeywords: true },
  });
  const matchedKeywords = analysis
    ? withAddedSkills(
        { matchedKeywords: analysis.matchedKeywords as string[], missingKeywords: analysis.missingKeywords as string[] },
        resume.skills,
      ).matchedKeywords
    : [];

  try {
    const options = await generateSummaryOptions(resume, jobDescription, matchedKeywords);
    return NextResponse.json<SummaryGenerateResponse>({ options });
  } catch (error) {
    console.error("summary generation failed", error);
    return aiErrorResponse(error, {
      code: "SUMMARY_FAILED",
      message: "We couldn't write summary options for this job. Please try again.",
    });
  }
}
