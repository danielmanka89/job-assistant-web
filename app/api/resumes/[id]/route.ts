import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateResumeUpdate } from "@/lib/resume-validation";
import type { Resume } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

// Another user's resume gets the same 404 as a missing one, so ids can't be probed.
const NOT_FOUND = () => apiError(404, "RESUME_NOT_FOUND", "Resume not found");

/** GET /api/resumes/:id — loads one of the logged-in user's resumes. */
export async function GET(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to view this resume");

  const { id } = await params;
  const resume = await prisma.resume.findFirst({ where: { id, userId: user.id } });
  if (!resume) return NOT_FOUND();
  return NextResponse.json<Resume>(toResume(resume));
}

/**
 * PUT /api/resumes/:id — replaces the editable fields (contact, summary, workExperience,
 * education, skills). id, userId, sourceFileName and timestamps are ignored if sent.
 */
export async function PUT(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to edit this resume");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const result = validateResumeUpdate(body);
  if ("fieldErrors" in result) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", result.fieldErrors);
  }

  const { id } = await params;
  try {
    const { count } = await prisma.resume.updateMany({
      where: { id, userId: user.id },
      data: {
        contact: { ...result.data.contact },
        summary: result.data.summary,
        workExperience: result.data.workExperience as object[],
        education: result.data.education as object[],
        skills: result.data.skills,
      },
    });
    if (count === 0) return NOT_FOUND();

    const updated = await prisma.resume.findUniqueOrThrow({ where: { id } });
    return NextResponse.json<Resume>(toResume(updated));
  } catch (error) {
    console.error("resume update failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
