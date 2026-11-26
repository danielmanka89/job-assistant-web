import { NextResponse, type NextRequest } from "next/server";
import { AiError } from "@/lib/ai";
import { aiErrorResponse, apiError, jobDescriptionError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { matchPercent } from "@/lib/skills";
import { createGapAnalysis } from "@/lib/tailoring";
import type { GapAnalysisResponse, SuggestedBullet } from "@/lib/types";

/**
 * POST /api/gap-analysis — compares one of the user's resumes with a pasted job description.
 * The result is stored so the tailoring step can look up the accepted bullets by id.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to analyze a job description");

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

  let analysis;
  try {
    // The profile's skills count as the candidate's, so they match job keywords too.
    analysis = await createGapAnalysis(user.id, row, jobDescription);
  } catch (error) {
    if (error instanceof AiError) {
      console.error("gap analysis failed", error);
      return aiErrorResponse(error, {
        code: "ANALYSIS_FAILED",
        message: "We couldn't analyze this job description. Please try again.",
      });
    }
    console.error("saving gap analysis failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }

  const matchedKeywords = analysis.matchedKeywords as string[];
  const missingKeywords = analysis.missingKeywords as string[];
  return NextResponse.json<GapAnalysisResponse>({
    id: analysis.id,
    matchedKeywords,
    missingKeywords,
    suggestedBullets: analysis.suggestedBullets as unknown as SuggestedBullet[],
    matchPercent: matchPercent(matchedKeywords.length, missingKeywords.length),
  });
}
