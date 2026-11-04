import { NextResponse, type NextRequest } from "next/server";
import { apiError, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { profileFromResume } from "@/lib/profile";
import { portfolioPath } from "@/lib/public-portfolio";
import type { PortfolioStatusResponse } from "@/lib/types";

/**
 * POST /api/profile/public — the candidate approves sharing: their portfolio at /profile/<userId>
 * becomes public. Needs a resume, since the portfolio is built from it.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to share your portfolio");

  const latest = await prisma.resume.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  if (!latest) return apiError(400, "NO_RESUME", "Upload your resume first: your portfolio is built from it");

  const now = new Date();
  const profile = await prisma.candidateProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, values: profileFromResume(toResume(latest)), publishedAt: now },
    update: { publishedAt: now },
  });
  return NextResponse.json<PortfolioStatusResponse>({ userId: user.id, path: portfolioPath(user.id), publishedAt: profile.publishedAt!.toISOString() });
}

/** DELETE /api/profile/public — makes the portfolio private again; the link stops working at once. */
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to change your portfolio");

  await prisma.candidateProfile.updateMany({ where: { userId: user.id }, data: { publishedAt: null } });
  return NextResponse.json<PortfolioStatusResponse>({ userId: user.id, path: portfolioPath(user.id), publishedAt: null });
}
