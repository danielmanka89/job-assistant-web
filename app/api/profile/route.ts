import { NextResponse, type NextRequest } from "next/server";
import { apiError, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { profileFromResume } from "@/lib/profile";
import type { ProfileResponse, ProfileValues } from "@/lib/types";

/**
 * GET /api/profile — the job seeker's profile and their latest resume, shown in full. The profile
 * comes only from the resume and can't be edited here: with no profile yet it's created from the
 * latest resume; after that it changes only through POST /api/resume/confirm-sync.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your profile");

  const [row, latest] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { userId: user.id } }),
    prisma.resume.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const resume = latest ? toResume(latest) : null;
  if (row) {
    return NextResponse.json<ProfileResponse>({
      values: row.values as ProfileValues,
      updatedAt: row.updatedAt.toISOString(),
      resume,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    });
  }
  if (!resume) return NextResponse.json<ProfileResponse>({ values: {}, updatedAt: null, resume: null, publishedAt: null });

  const created = await prisma.candidateProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, values: profileFromResume(resume) },
    update: {},
  });
  return NextResponse.json<ProfileResponse>({
    values: created.values as ProfileValues,
    updatedAt: created.updatedAt.toISOString(),
    resume,
    publishedAt: created.publishedAt?.toISOString() ?? null,
  });
}
