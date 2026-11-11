import { NextResponse, type NextRequest } from "next/server";
import { generateMockCallPrep } from "@/lib/ai";
import { aiErrorResponse, apiError, jobDescriptionError, readJsonObject, toResume, toSubmission } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rowLabel } from "@/lib/spreadsheet";
import type { MockCallPrepResponse, PrepQuestion } from "@/lib/types";

// Writing 50 answers takes the model a few minutes.
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

/** The user's submission with what the prep is written from: its job posting, saved prep and their latest resume. */
async function load(userId: string, id: string) {
  const row = await prisma.submission.findFirst({ where: { id, userId }, include: { jobPosting: true, mockCallPrep: true } });
  if (!row) return null;
  const resume = await prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  return { row, resume };
}

function respond(
  row: NonNullable<Awaited<ReturnType<typeof load>>>["row"],
  latestResumeId: string | undefined,
  saved: { questions: unknown; resumeId: string; jobDescription: string | null; updatedAt: Date } | null,
) {
  const { title, company } = rowLabel(toSubmission(row));
  return NextResponse.json<MockCallPrepResponse>({
    job: { title, company },
    hasResume: Boolean(latestResumeId),
    hasJobDescription: Boolean(row.jobPosting?.description || saved?.jobDescription),
    prep: saved
      ? { questions: saved.questions as PrepQuestion[], createdAt: saved.updatedAt.toISOString(), upToDate: saved.resumeId === latestResumeId }
      : null,
  });
}

/** GET /api/submissions/:id/prep — the saved mock call preparation for this submission, if any. */
export async function GET(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your mock call preparation");

  const found = await load(user.id, (await params).id);
  if (!found) return apiError(404, "SUBMISSION_NOT_FOUND", "That submission was deleted");
  return respond(found.row, found.resume?.id, found.row.mockCallPrep);
}

/**
 * POST /api/submissions/:id/prep — writes (or rewrites) 50 questions and answers from the job
 * description and the latest resume, and saves them. Rows added by hand have no job posting, so the
 * body carries { jobDescription } the first time; it's kept for later rewrites.
 */
export async function POST(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to prepare for your call");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const found = await load(user.id, (await params).id);
  if (!found) return apiError(404, "SUBMISSION_NOT_FOUND", "That submission was deleted");
  const { row, resume } = found;
  if (!resume) return apiError(400, "NO_RESUME", "Upload your resume first: your answers are written from it");

  // The job posting's own description wins; otherwise the one pasted now, or the one pasted last time.
  const pasted = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  let pastedToSave: string | null = null;
  let description = row.jobPosting?.description ?? "";
  if (!description) {
    description = pasted || row.mockCallPrep?.jobDescription || "";
    const error = jobDescriptionError(description);
    if (error) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { jobDescription: error });
    pastedToSave = description;
  }

  const { title, company } = rowLabel(toSubmission(row));
  let questions: PrepQuestion[];
  try {
    questions = await generateMockCallPrep(toResume(resume), { title: row.jobPosting?.title ?? title, company: row.jobPosting?.company ?? company, description });
  } catch (error) {
    console.error("mock call prep failed", error);
    return aiErrorResponse(error, { code: "PREP_UNREADABLE", message: "We couldn't write your questions this time. Please try again." });
  }

  const data = { resumeId: resume.id, jobDescription: pastedToSave, questions: questions as object[] };
  try {
    const saved = await prisma.mockCallPrep.upsert({ where: { submissionId: row.id }, create: { submissionId: row.id, ...data }, update: data });
    return respond(row, resume.id, saved);
  } catch (error) {
    // The row was deleted while the questions were being written.
    console.error("saving mock call prep failed", error);
    return apiError(404, "SUBMISSION_NOT_FOUND", "That submission was deleted");
  }
}
