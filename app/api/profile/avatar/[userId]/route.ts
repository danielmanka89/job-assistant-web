import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Context = { params: Promise<{ userId: string }> };

/** GET /api/profile/avatar/:userId — the menu photo, for its owner only (it's never shown publicly). */
export async function GET(request: NextRequest, { params }: Context) {
  const { userId } = await params;
  const viewer = await getSessionUser(request);
  if (viewer?.id !== userId) return apiError(404, "PHOTO_NOT_FOUND", "No photo");

  const photo = await prisma.avatarPhoto.findUnique({ where: { userId } });
  if (!photo) return apiError(404, "PHOTO_NOT_FOUND", "No photo");
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.data.length),
      // The address changes with every upload (?v=), so a short private cache is safe.
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
