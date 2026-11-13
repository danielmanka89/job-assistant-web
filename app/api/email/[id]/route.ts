import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toEmailDetail } from "@/lib/email";
import type { EmailDetail } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

/** GET /api/email/:id — one of your emails in full. Opening a received email marks it read. */
export async function GET(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your inbox");

  const row = await prisma.emailMessage.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!row) return apiError(404, "EMAIL_NOT_FOUND", "That email doesn't exist");

  const readAt = row.readAt ?? new Date();
  if (!row.readAt) await prisma.emailMessage.updateMany({ where: { id: row.id, userId: user.id }, data: { readAt } });
  return NextResponse.json<EmailDetail>(toEmailDetail({ ...row, readAt }));
}

/** DELETE /api/email/:id — removes one of your emails for good. */
export async function DELETE(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to manage your inbox");

  const { count } = await prisma.emailMessage.deleteMany({ where: { id: (await params).id, userId: user.id } });
  if (!count) return apiError(404, "EMAIL_NOT_FOUND", "That email doesn't exist");
  return new NextResponse(null, { status: 204 });
}
