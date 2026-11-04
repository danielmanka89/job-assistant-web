import { prisma } from "@/lib/db";
import { profileFromResume, splitList } from "@/lib/profile";
import { toResume } from "@/lib/api";
import type { ProfileValues, PublicPortfolio } from "@/lib/types";

export const portfolioPath = (userId: string) => `/profile/${userId}`;

/**
 * The public portfolio for a candidate, or null when there isn't one to show: unknown user, or a
 * candidate who hasn't approved sharing (both look the same, so nobody can tell accounts apart).
 * Built from the profile plus the latest resume; work authorization and pay rate are never included.
 */
export async function getPublicPortfolio(userId: string): Promise<PublicPortfolio | null> {
  if (!userId || userId.length > 64) return null;
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, include: { user: { select: { name: true } } } });
  if (!profile?.publishedAt) return null;

  const latest = await prisma.resume.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const resume = latest ? toResume(latest) : null;
  const values = { ...(resume ? profileFromResume(resume) : {}), ...(profile.values as ProfileValues) };

  return {
    userId,
    name: values.fullName?.trim() || profile.user.name,
    email: values.email?.trim() ?? "",
    phone: values.phone?.trim() ?? "",
    location: values.location?.trim() ?? "",
    linkedinUrl: values.linkedinUrl?.trim() ?? "",
    websiteUrl: values.websiteUrl?.trim() ?? "",
    summary: resume?.summary?.trim() ?? "",
    skills: splitList(values.skills),
    certifications: splitList(values.certifications),
    workExperience: (resume?.workExperience ?? []).map(({ jobTitle, company, location, startDate, endDate }) => ({ jobTitle, company, location, startDate, endDate })),
    education: (resume?.education ?? []).map(({ institution, degree, fieldOfStudy, startDate, endDate }) => ({ institution, degree, fieldOfStudy, startDate, endDate })),
    resumeFileName: latest?.sourceFileName ?? (latest ? "Resume" : null),
  };
}
