import { prisma } from "@/lib/db";
import type { ProfileValues } from "@/lib/types";

/** The user's saved profile, or {} if they haven't saved one. */
export async function getProfileValues(userId: string): Promise<ProfileValues> {
  const row = await prisma.candidateProfile.findUnique({ where: { userId } });
  return (row?.values as ProfileValues | undefined) ?? {};
}
