import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { conversationsWithUnread, touchPresence } from "@/lib/connections";
import { prisma } from "@/lib/db";
import type { ChatSummary } from "@/lib/types";

/** GET /api/chat/summary — unread messages, unread emails, follow counts and waiting follow requests, for the menu. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in");

  // The menu asks for this every 30 seconds while a tab is open and visible, so it doubles as the
  // "in the app" check-in that shows this user as ON in Chat.
  const [conversations, connectedTo, connectedToMe, requests, newest, emailUnread] = await Promise.all([
    touchPresence(user.id).then(() => conversationsWithUnread(user.id)),
    prisma.connection.count({ where: { fromUserId: user.id, status: "accepted" } }),
    prisma.connection.count({ where: { toUserId: user.id, status: "accepted" } }),
    prisma.connection.count({ where: { toUserId: user.id, status: "pending" } }),
    prisma.connection.findMany({ where: { toUserId: user.id, status: "pending" }, orderBy: { createdAt: "desc" }, take: 3, select: { fromUser: { select: { id: true, name: true } } } }),
    prisma.emailMessage.count({ where: { userId: user.id, direction: "in", readAt: null } }),
  ]);
  return NextResponse.json<ChatSummary>({
    unread: conversations.reduce((n, c) => n + c.unread, 0),
    emailUnread,
    connectedTo,
    connectedToMe,
    requests,
    requesters: newest.map((c) => c.fromUser),
  });
}
