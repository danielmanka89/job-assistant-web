import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** DELETE /api/connections/:userId — removes your connection to that person. Theirs to you, if any, stays. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to change your connections");

  const { userId } = await params;
  await prisma.connection.deleteMany({ where: { fromUserId: user.id, toUserId: userId } });
  return new Response(null, { status: 204 });
}
