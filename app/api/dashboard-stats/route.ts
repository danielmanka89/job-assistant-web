import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { DashboardStats } from "@/lib/types";

/**
 * GET /api/dashboard-stats — the user's tailored resume count and average final match, plus how many
 * jobs are on the board. Jobs are counted as stored; this doesn't call the external providers.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your dashboard");

  const [tailored, jobsBySource] = await Promise.all([
    prisma.tailoredResume.aggregate({
      where: { userId: user.id },
      _count: { _all: true },
      _avg: { finalMatchPercent: true }, // rows without a score are skipped
    }),
    prisma.jobPosting.groupBy({ by: ["source"], _count: { _all: true } }),
  ]);

  const total = jobsBySource.reduce((sum, g) => sum + g._count._all, 0);
  const native = jobsBySource.find((g) => g.source === "native")?._count._all ?? 0;
  const average = tailored._avg.finalMatchPercent;
  return NextResponse.json<DashboardStats>({
    tailoredResumeCount: tailored._count._all,
    averageMatchPercent: average === null ? null : Math.round(average),
    jobs: { total, native, external: total - native },
  });
}
