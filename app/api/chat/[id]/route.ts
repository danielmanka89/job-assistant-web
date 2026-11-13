import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { areConnected, mySide, toPeople } from "@/lib/connections";
import { prisma } from "@/lib/db";
import { MAX_MESSAGE_CHARS, type ChatMessage, type ChatThreadResponse } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

const PAGE = 200; // most recent messages shown when a chat is opened

const toMessage = (m: { id: string; senderId: string; body: string; createdAt: Date }): ChatMessage => ({
  id: m.id,
  senderId: m.senderId,
  body: m.body,
  createdAt: m.createdAt.toISOString(),
});

/** The conversation, if the user is one of its two people. */
async function findMine(id: string, userId: string) {
  return prisma.conversation.findFirst({ where: { id, OR: [{ userAId: userId }, { userBId: userId }] } });
}

/**
 * GET /api/chat/:id — the chat's latest messages, oldest first, and marks it read. With
 * ?after=<ISO time> only messages newer than that are returned (used to poll for new ones).
 */
export async function GET(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your chats");

  const conversation = await findMine((await params).id, user.id);
  if (!conversation) return apiError(404, "CHAT_NOT_FOUND", "That chat doesn't exist");
  const { otherId, readField } = mySide(conversation, user.id);

  const afterParam = request.nextUrl.searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : null;
  const validAfter = after && !Number.isNaN(after.getTime()) ? after : null;

  const [rows, other, canSend] = await Promise.all([
    validAfter
      ? prisma.message.findMany({ where: { conversationId: conversation.id, createdAt: { gt: validAfter } }, orderBy: { createdAt: "asc" }, take: PAGE })
      : prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "desc" }, take: PAGE }).then((r) => r.reverse()),
    prisma.user.findUnique({ where: { id: otherId }, select: { id: true, name: true, role: true } }),
    areConnected(user.id, otherId),
    prisma.conversation.update({ where: { id: conversation.id }, data: { [readField]: new Date() } }),
  ]);
  if (!other) return apiError(404, "CHAT_NOT_FOUND", "That chat doesn't exist");
  const [person] = await toPeople(user.id, [other]);

  return NextResponse.json<ChatThreadResponse>({ id: conversation.id, person, canSend, messages: rows.map(toMessage) });
}

/** POST /api/chat/:id { body } — sends a message. Allowed while either of you is connected to the other. */
export async function POST(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to chat");

  const json = await readJsonObject(request);
  if (!json) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const text = typeof json.body === "string" ? json.body.trim() : "";
  if (!text) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { body: "Write a message first" });
  if (text.length > MAX_MESSAGE_CHARS) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { body: `Messages can be at most ${MAX_MESSAGE_CHARS} characters` });
  }

  const conversation = await findMine((await params).id, user.id);
  if (!conversation) return apiError(404, "CHAT_NOT_FOUND", "That chat doesn't exist");
  const { otherId, readField } = mySide(conversation, user.id);
  if (!(await areConnected(user.id, otherId))) {
    return apiError(403, "NOT_CONNECTED", "You're no longer connected with this person. Connect again to send messages.");
  }

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conversation.id, senderId: user.id, body: text, createdAt: now } }),
    prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now, [readField]: now } }),
  ]);
  return NextResponse.json<ChatMessage>(toMessage(message), { status: 201 });
}
