import { NextResponse, type NextRequest } from "next/server";
import { apiError, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recentJobDescriptions, toLearningPath } from "@/lib/learning-store";
import { marketReach } from "@/lib/market-reach";
import type { LearningInsights } from "@/lib/types";

/**
 * GET /api/learning — Market Reach for the latest resume against open jobs, the missing skills
 * worth learning, and the user's learning paths. Stores the baseline on the resume the first time.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your learning dashboard");

  const [resumeRow, jobs, paths] = await Promise.all([
    prisma.resume.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    recentJobDescriptions(),
    prisma.learningPath.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!resumeRow) {
    return NextResponse.json<LearningInsights>({
      hasResume: false,
      marketReachPercent: 0,
      baselinePercent: null,
      jobsAnalyzed: 0,
      missingSkills: [],
      paths: paths.map(toLearningPath),
    });
  }

  const reach = marketReach(toResume(resumeRow), jobs);
  let baseline = resumeRow.marketReachPercent;
  if (baseline === null) {
    baseline = reach.percent;
    await prisma.resume.update({ where: { id: resumeRow.id }, data: { marketReachPercent: baseline } }).catch(() => undefined);
  }
  return NextResponse.json<LearningInsights>({
    hasResume: true,
    marketReachPercent: reach.percent,
    baselinePercent: baseline,
    jobsAnalyzed: reach.jobsAnalyzed,
    missingSkills: reach.missingSkills,
    paths: paths.map(toLearningPath),
  });
}
