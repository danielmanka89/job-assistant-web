import { NextResponse, type NextRequest } from "next/server";
import { analyzeGap } from "@/lib/ai";
import { aiErrorResponse, apiError, readJsonObject, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { matchPercent } from "@/lib/skills";
import type { GapAnalysisResponse } from "@/lib/types";

// Same limits as the job description field in the UI.
const MIN_JD_CHARS = 50;
const MAX_JD_CHARS = 20_000;

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
  if (!jobDescription) fieldErrors.jobDescription = "Paste a job description to analyze.";
  else if (jobDescription.length < MIN_JD_CHARS) {
    fieldErrors.jobDescription = `That looks too short. Paste the full job description (at least ${MIN_JD_CHARS} characters).`;
  } else if (jobDescription.length > MAX_JD_CHARS) {
    fieldErrors.jobDescription = `Job descriptions can be at most ${MAX_JD_CHARS.toLocaleString("en-US")} characters.`;
  }
  if (Object.keys(fieldErrors).length) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);
  }

  const row = await prisma.resume.findFirst({ where: { id: resumeId, userId: user.id } });
  if (!row) return apiError(404, "RESUME_NOT_FOUND", "Resume not found");

  let result;
  try {
    result = await analyzeGap(toResume(row), jobDescription);
  } catch (error) {
    console.error("gap analysis failed", error);
    return aiErrorResponse(error, {
      code: "ANALYSIS_FAILED",
      message: "We couldn't analyze this job description. Please try again.",
    });
  }

  try {
    const analysis = await prisma.gapAnalysis.create({
      data: {
        userId: user.id,
        resumeId: row.id,
        jobDescription,
        matchedKeywords: result.matchedKeywords,
        missingKeywords: result.missingKeywords,
        suggestedBullets: result.suggestedBullets as object[],
      },
    });
    return NextResponse.json<GapAnalysisResponse>({
      id: analysis.id,
      ...result,
      matchPercent: matchPercent(result.matchedKeywords.length, result.missingKeywords.length),
    });
  } catch (error) {
    console.error("saving gap analysis failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
