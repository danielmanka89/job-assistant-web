import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { areConnected, conversationsWithUnread, mySide, pairKey, toPeople } from "@/lib/connections";
import { prisma } from "@/lib/db";
import type { ChatListResponse } from "@/lib/types";

/** GET /api/chat — your chats, most recent first, each with its last message and unread count. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your chats");

  const conversations = await conversationsWithUnread(user.id);
  const otherIds = conversations.map((c) => mySide(c.row, user.id).otherId);
  const [users, lastMessages] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: otherIds } }, select: { id: true, name: true, role: true } }),
    Promise.all(
      conversations.map((c) => prisma.message.findFirst({ where: { conversationId: c.row.id }, orderBy: { createdAt: "desc" }, select: { body: true } })),
    ),
  ]);
  const people = new Map((await toPeople(user.id, users)).map((p) => [p.id, p]));

  return NextResponse.json<ChatListResponse>({
    conversations: conversations.flatMap((c, i) => {
      const person = people.get(mySide(c.row, user.id).otherId);
      if (!person) return [];
      return [{ id: c.row.id, person, lastMessage: lastMessages[i]?.body ?? null, lastMessageAt: c.row.lastMessageAt.toISOString(), unread: c.unread }];
    }),
  });
}

/**
 * POST /api/chat { userId } — opens your chat with someone and returns its id, creating it the first
 * time. You can start a chat once either of you is connected to the other.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to chat");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const userId = body.userId;
  if (typeof userId !== "string" || !userId || userId.length > 100 || userId === user.id) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { userId: "Must be another user's id" });
  }

  const key = pairKey(user.id, userId);
  const existing = await prisma.conversation.findUnique({ where: { userAId_userBId: key }, select: { id: true } });
  if (existing) return NextResponse.json({ id: existing.id });

  if (!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    return apiError(404, "USER_NOT_FOUND", "That person's account no longer exists");
  }
  if (!(await areConnected(user.id, userId))) return apiError(403, "NOT_CONNECTED", "Connect with this person first to start a chat");

  // upsert: two opens at once end up with the same row.
  const conversation = await prisma.conversation.upsert({ where: { userAId_userBId: key }, create: key, update: {}, select: { id: true } });
  return NextResponse.json({ id: conversation.id }, { status: 201 });
}
