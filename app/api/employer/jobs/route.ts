import { NextResponse, type NextRequest } from "next/server";
import { apiError, toJobPosting } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { JobListResponse } from "@/lib/types";

/** GET /api/employer/jobs — the jobs the logged-in employer has posted, newest first. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your job postings");
  if (user.role !== "EMPLOYER") return apiError(403, "EMPLOYER_ONLY", "Only employer accounts have job postings");

  const jobs = await prisma.jobPosting.findMany({
    where: { postedById: user.id, source: "native" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json<JobListResponse>({ jobs: jobs.map(toJobPosting) });
}
