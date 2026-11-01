import type { LearningPath as LearningPathRow } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { LearningPath, LearningStatus } from "@/lib/types";

const RECENT_JOBS = 200; // Market Reach is measured against the newest postings

/** Descriptions of the newest open jobs, for Market Reach. */
export async function recentJobDescriptions(): Promise<string[]> {
  const jobs = await prisma.jobPosting.findMany({ select: { description: true }, orderBy: { createdAt: "desc" }, take: RECENT_JOBS });
  return jobs.map((j) => j.description);
}

export function toLearningPath(row: LearningPathRow): LearningPath {
  return {
    id: row.id,
    skillName: row.skillName,
    status: row.status as LearningStatus,
    progress: row.progress,
    completedSteps: Array.isArray(row.completedSteps) ? (row.completedSteps as string[]) : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
