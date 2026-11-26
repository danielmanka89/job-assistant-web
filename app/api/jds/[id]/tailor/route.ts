import { NextResponse, type NextRequest } from "next/server";
import { AiError } from "@/lib/ai";
import { aiErrorResponse, apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createGapAnalysis, createTailoredResume } from "@/lib/tailoring";
import { JD_INCLUDE, toVendorJd } from "@/lib/vendor-jds";
import type { SuggestedBullet, VendorJd } from "@/lib/types";

export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/jds/:id/tailor — tailors your latest resume to this JD in one step: compares them,
 * applies every suggested rewording (each only rewords your own bullets, nothing is invented),
 * renders the PDF and Word files, and links them to the JD. Run again after changing your resume.
 */
export async function POST(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to tailor your resume");
  const { id } = await params;

  const jd = await prisma.vendorJd.findFirst({ where: { id, userId: user.id }, select: { id: true, jobDescription: true } });
  if (!jd) return apiError(404, "JD_NOT_FOUND", "That JD isn't saved anymore");
  const resume = await prisma.resume.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  if (!resume) return apiError(400, "NO_RESUME", "Upload your resume first, then tailor it to this JD.");

  let analysis;
  try {
    analysis = await createGapAnalysis(user.id, resume, jd.jobDescription);
  } catch (error) {
    console.error("JD analysis failed", error);
    if (error instanceof AiError) {
      return aiErrorResponse(error, { code: "ANALYSIS_FAILED", message: "We couldn't read this JD. Please try again." });
    }
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }

  const accepted = (analysis.suggestedBullets as unknown as SuggestedBullet[]).map((s) => s.id);
  let tailoredId: string;
  try {
    const result = await createTailoredResume(user.id, resume, analysis, accepted, ["pdf", "docx"]);
    tailoredId = result.tailoredResume.id;
  } catch (error) {
    console.error("JD tailoring failed", error);
    return apiError(500, "GENERATION_FAILED", "We couldn't create your resume files. Please try again.");
  }

  const row = await prisma.vendorJd.update({ where: { id: jd.id }, data: { tailoredResumeId: tailoredId }, include: JD_INCLUDE });
  return NextResponse.json<VendorJd>(toVendorJd(row));
}
