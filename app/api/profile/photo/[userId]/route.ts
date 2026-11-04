import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Context = { params: Promise<{ userId: string }> };

/**
 * GET /api/profile/photo/:userId — the profile photo. Anyone may see it while the candidate's
 * portfolio is public; otherwise only the candidate. 404 either way when it can't be shown.
 */
export async function GET(request: NextRequest, { params }: Context) {
  const { userId } = await params;
  const photo = await prisma.profilePhoto.findUnique({ where: { userId } });
  if (!photo) return apiError(404, "PHOTO_NOT_FOUND", "No photo");

  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { publishedAt: true } });
  const isPublic = Boolean(profile?.publishedAt);
  if (!isPublic) {
    const viewer = await getSessionUser(request);
    if (viewer?.id !== userId) return apiError(404, "PHOTO_NOT_FOUND", "No photo");
  }

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.data.length),
      // The address changes with every upload (?v=), so a short private cache is safe.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
