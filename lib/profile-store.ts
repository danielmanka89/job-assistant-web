import type { Resume as ResumeRow } from "@/lib/generated/prisma/client";
import { toResume } from "@/lib/api";
import { prisma } from "@/lib/db";
import { profileFromResume } from "@/lib/profile";
import type { ProfileValues } from "@/lib/types";

/** The user's profile, or {} if they don't have one yet. */
export async function getProfileValues(userId: string): Promise<ProfileValues> {
  const row = await prisma.candidateProfile.findUnique({ where: { userId } });
  return (row?.values as ProfileValues | undefined) ?? {};
}

/**
 * After the user edits a resume themselves (Review page, adding skills), keeps the profile matching
 * it, if it's their latest upload. Edits to older resumes don't touch the profile.
 */
export async function syncProfileToEditedResume(row: Omit<ResumeRow, "data">): Promise<void> {
  const latest = await prisma.resume.findFirst({ where: { userId: row.userId }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (latest?.id !== row.id) return;
  const values = profileFromResume(toResume(row));
  await prisma.candidateProfile.upsert({ where: { userId: row.userId }, create: { userId: row.userId, values }, update: { values } });
}
