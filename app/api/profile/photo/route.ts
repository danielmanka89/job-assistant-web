import { NextResponse, type NextRequest } from "next/server";
import { apiError, toUser } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_PHOTO_BYTES, photoType, photoUrl } from "@/lib/profile-photo";
import type { AccountResponse } from "@/lib/types";

/** PUT /api/profile/photo — sets the profile photo (multipart, field "file": JPEG, PNG or WebP). */
export async function PUT(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to change your photo");

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) return apiError(400, "NO_FILE", "Choose a photo to upload");
  if (file.size > MAX_PHOTO_BYTES) return apiError(413, "FILE_TOO_LARGE", "That photo is too large. Use one under 1.5 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = photoType(bytes);
  if (!mimeType) return apiError(415, "UNSUPPORTED_TYPE", "Use a JPEG, PNG or WebP photo");

  const savedAt = new Date();
  const [, updated] = await prisma.$transaction([
    prisma.profilePhoto.upsert({
      where: { userId: user.id },
      create: { userId: user.id, data: bytes, mimeType },
      update: { data: bytes, mimeType },
    }),
    prisma.user.update({ where: { id: user.id }, data: { profilePictureUrl: photoUrl(user.id, savedAt) } }),
  ]);
  return NextResponse.json<AccountResponse>({ user: toUser(updated) });
}

/** DELETE /api/profile/photo — removes the photo; initials show again. */
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to change your photo");

  const [, updated] = await prisma.$transaction([
    prisma.profilePhoto.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { profilePictureUrl: null } }),
  ]);
  return NextResponse.json<AccountResponse>({ user: toUser(updated) });
}
