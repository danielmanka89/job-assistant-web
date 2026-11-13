import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { JobPitchListResponse } from "@/lib/types";

/** GET /api/job-pitches — your "Why should I hire you?" answers on the Job Board, one per job. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your answers");
  const rows = await prisma.jobPitch.findMany({ where: { userId: user.id }, select: { jobPostingId: true, text: true, updatedAt: true } });
  return NextResponse.json<JobPitchListResponse>({
    pitches: rows.map((r) => ({ jobId: r.jobPostingId, text: r.text, updatedAt: r.updatedAt.toISOString() })),
  });
}
