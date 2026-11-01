import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";
import { apiError, readJsonObject, toResume, toSubmission } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProfileValues } from "@/lib/profile-store";
import { prefillSubmission } from "@/lib/spreadsheet";
import type { CreateSubmissionResponse, SubmissionListResponse } from "@/lib/types";

const MAX_SUBMISSIONS = 2000; // per user; keeps the page and the Excel export a sensible size

/** GET /api/submissions — the user's submissions (Spreadsheet rows), newest first. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your spreadsheet");

  const rows = await prisma.submission.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json<SubmissionListResponse>({ submissions: rows.map(toSubmission) });
}

/**
 * POST /api/submissions — records an application. With { jobId } the row is prefilled from the job,
 * the user's saved profile, their latest resume and their latest gap analysis of that job; applying to the same job
 * again returns the existing row (200, created: false). Without a jobId the row starts blank (201).
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to track your applications");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const jobId = body.jobId;
  if (jobId !== undefined && (typeof jobId !== "string" || !jobId || jobId.length > 100)) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { jobId: "Must be a job id" });
  }

  if (jobId) {
    const existing = await prisma.submission.findUnique({ where: { userId_jobPostingId: { userId: user.id, jobPostingId: jobId } } });
    if (existing) return NextResponse.json<CreateSubmissionResponse>({ submission: toSubmission(existing), created: false });
  }

  const count = await prisma.submission.count({ where: { userId: user.id } });
  if (count >= MAX_SUBMISSIONS) {
    return apiError(409, "TOO_MANY_SUBMISSIONS", `You can keep up to ${MAX_SUBMISSIONS} submissions. Delete some old rows first.`);
  }

  let cells = { vendor: {}, submission: {}, skills: {}, client: {} };
  if (jobId) {
    const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
    if (!job) return apiError(404, "JOB_NOT_FOUND", "That job is no longer listed");
    const [resume, analysis, profile] = await Promise.all([
      prisma.resume.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
      prisma.gapAnalysis.findFirst({
        where: { userId: user.id, jobDescription: job.description },
        orderBy: { createdAt: "desc" },
        select: { matchedKeywords: true, missingKeywords: true },
      }),
      getProfileValues(user.id),
    ]);
    cells = prefillSubmission(
      job,
      resume ? toResume(resume) : null,
      analysis
        ? { matchedKeywords: analysis.matchedKeywords as string[], missingKeywords: analysis.missingKeywords as string[] }
        : null,
      profile,
    );
  }

  try {
    const row = await prisma.submission.create({ data: { userId: user.id, jobPostingId: jobId ?? null, ...cells } });
    return NextResponse.json<CreateSubmissionResponse>({ submission: toSubmission(row), created: true }, { status: 201 });
  } catch (error) {
    // Two Apply clicks at once: the other request created the row first.
    if (jobId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.submission.findUnique({ where: { userId_jobPostingId: { userId: user.id, jobPostingId: jobId } } });
      if (existing) return NextResponse.json<CreateSubmissionResponse>({ submission: toSubmission(existing), created: false });
    }
    console.error("creating submission failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
