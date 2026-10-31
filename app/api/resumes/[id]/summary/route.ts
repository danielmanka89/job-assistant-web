import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Resume } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

// Same limit as the summary field in PUT /api/resumes/:id.
const MAX_SUMMARY_CHARS = 2000;

/** PATCH /api/resumes/:id/summary — replaces the resume's summary with { newSummary: string }. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to edit this resume");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const newSummary = typeof body.newSummary === "string" ? body.newSummary.trim() : "";
  if (!newSummary) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { newSummary: "Required" });
  }
  if (newSummary.length > MAX_SUMMARY_CHARS) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", {
      newSummary: `Must be ${MAX_SUMMARY_CHARS} characters or fewer`,
    });
  }

  const { id } = await params;
  try {
    const { count } = await prisma.resume.updateMany({ where: { id, userId: user.id }, data: { summary: newSummary } });
    // Another user's resume gets the same 404 as a missing one, so ids can't be probed.
    if (count === 0) return apiError(404, "RESUME_NOT_FOUND", "Resume not found");

    const updated = await prisma.resume.findUniqueOrThrow({ where: { id } });
    return NextResponse.json<Resume>(toResume(updated));
  } catch (error) {
    console.error("summary update failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
