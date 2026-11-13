import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { conversationsWithUnread } from "@/lib/connections";
import { prisma } from "@/lib/db";
import type { ChatSummary } from "@/lib/types";

/** GET /api/chat/summary — unread messages, unread emails and the account's two connection counts, for the menu. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in");

  const [conversations, connectedTo, connectedToMe, emailUnread] = await Promise.all([
    conversationsWithUnread(user.id),
    prisma.connection.count({ where: { fromUserId: user.id } }),
    prisma.connection.count({ where: { toUserId: user.id } }),
    prisma.emailMessage.count({ where: { userId: user.id, direction: "in", readAt: null } }),
  ]);
  return NextResponse.json<ChatSummary>({ unread: conversations.reduce((n, c) => n + c.unread, 0), emailUnread, connectedTo, connectedToMe });
}
