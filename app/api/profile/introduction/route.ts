import { NextResponse, type NextRequest } from "next/server";
import { generateIntroduction } from "@/lib/ai";
import { aiErrorResponse, apiError, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { IntroductionResponse } from "@/lib/types";

// Writing ~2,000 words takes the model a while.
export const maxDuration = 300;

const countWords = (paragraphs: string[]) => paragraphs.join(" ").split(/\s+/).filter(Boolean).length;

async function latestResume(userId: string) {
  return prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
}

/** GET /api/profile/introduction — the saved introduction, if any, and whether it matches the latest resume. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your introduction");

  const [saved, latest] = await Promise.all([prisma.introduction.findUnique({ where: { userId: user.id } }), latestResume(user.id)]);
  return NextResponse.json<IntroductionResponse>({
    hasResume: Boolean(latest),
    introduction: saved
      ? {
          paragraphs: saved.paragraphs as string[],
          wordCount: saved.wordCount,
          createdAt: saved.updatedAt.toISOString(),
          upToDate: saved.resumeId === latest?.id,
        }
      : null,
  });
}

/** POST /api/profile/introduction — writes (or rewrites) the introduction from the latest resume and saves it. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to write your introduction");

  const latest = await latestResume(user.id);
  if (!latest) return apiError(400, "NO_RESUME", "Upload your resume first: your introduction is written from it");

  let paragraphs: string[];
  try {
    paragraphs = await generateIntroduction(toResume(latest));
  } catch (error) {
    console.error("introduction failed", error);
    return aiErrorResponse(error, { code: "INTRODUCTION_UNREADABLE", message: "We couldn't write your introduction this time. Please try again." });
  }

  const wordCount = countWords(paragraphs);
  const saved = await prisma.introduction.upsert({
    where: { userId: user.id },
    create: { userId: user.id, resumeId: latest.id, paragraphs, wordCount },
    update: { resumeId: latest.id, paragraphs, wordCount },
  });
  return NextResponse.json<IntroductionResponse>({
    hasResume: true,
    introduction: { paragraphs, wordCount, createdAt: saved.updatedAt.toISOString(), upToDate: true },
  });
}
