import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Context = { params: Promise<{ userId: string }> };

/** POST /api/connections/requests/:userId — accepts that person's request to follow you. */
export async function POST(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to answer follow requests");

  const { count } = await prisma.connection.updateMany({
    where: { fromUserId: (await params).userId, toUserId: user.id, status: "pending" },
    data: { status: "accepted" },
  });
  if (!count) return apiError(404, "REQUEST_NOT_FOUND", "That request was cancelled or already answered");
  return new Response(null, { status: 204 });
}

/**
 * DELETE /api/connections/requests/:userId — declines that person's request, or removes them as a
 * follower. They aren't told; they just stop seeing it as pending.
 */
export async function DELETE(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to answer follow requests");

  await prisma.connection.deleteMany({ where: { fromUserId: (await params).userId, toUserId: user.id } });
  return new Response(null, { status: 204 });
}
