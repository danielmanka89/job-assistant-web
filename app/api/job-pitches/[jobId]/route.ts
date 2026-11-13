import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_PITCH_CHARS, MAX_PITCH_WORDS, countWords } from "@/lib/pitch";
import type { JobPitch } from "@/lib/types";

type Context = { params: Promise<{ jobId: string }> };

/**
 * PUT /api/job-pitches/:jobId { text } — saves your "Why should I hire you?" answer for a job
 * (at most 300 words). Saving an empty answer removes it (204).
 */
export async function PUT(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to save your answer");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  if (typeof body.text !== "string") return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { text: "Write your answer" });
  const text = body.text.trim();
  if (countWords(text) > MAX_PITCH_WORDS || text.length > MAX_PITCH_CHARS) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { text: `Keep it to ${MAX_PITCH_WORDS} words or fewer` });
  }

  const { jobId } = await params;
  if (!text) {
    await prisma.jobPitch.deleteMany({ where: { userId: user.id, jobPostingId: jobId } });
    return new Response(null, { status: 204 });
  }
  const job = await prisma.jobPosting.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) return apiError(404, "JOB_NOT_FOUND", "That job is no longer listed");

  const row = await prisma.jobPitch.upsert({
    where: { userId_jobPostingId: { userId: user.id, jobPostingId: jobId } },
    create: { userId: user.id, jobPostingId: jobId, text },
    update: { text },
  });
  return NextResponse.json<JobPitch>({ jobId, text: row.text, updatedAt: row.updatedAt.toISOString() });
}
