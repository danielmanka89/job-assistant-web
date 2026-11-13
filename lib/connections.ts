// Server helpers for connections and chat (Chat page). Connections are one-way rows.

import { prisma } from "@/lib/db";
import { CONNECTION_KINDS, type ConnectionKind, type Person, type UserRole } from "@/lib/types";

type UserBits = { id: string; name: string; role: string };

export const isConnectionKind = (value: unknown): value is ConnectionKind => CONNECTION_KINDS.includes(value as ConnectionKind);

/** Turns users into People as seen by `meId`: how I'm connected to each, and whether they're connected to me. */
export async function toPeople(meId: string, users: UserBits[]): Promise<Person[]> {
  if (!users.length) return [];
  const ids = users.map((u) => u.id);
  const [mine, theirs] = await Promise.all([
    prisma.connection.findMany({ where: { fromUserId: meId, toUserId: { in: ids } }, select: { toUserId: true, kind: true } }),
    prisma.connection.findMany({ where: { toUserId: meId, fromUserId: { in: ids } }, select: { fromUserId: true } }),
  ]);
  const kinds = new Map(mine.map((c) => [c.toUserId, c.kind]));
  const back = new Set(theirs.map((c) => c.fromUserId));
  return users.map((u) => {
    const kind = kinds.get(u.id);
    return {
      id: u.id,
      name: u.name,
      role: (u.role === "EMPLOYER" ? "EMPLOYER" : "SEEKER") as UserRole,
      connection: kind === undefined ? null : isConnectionKind(kind) ? kind : "other",
      connectedToMe: back.has(u.id),
    };
  });
}

/** True when either user is connected to the other, which is what allows them to chat. */
export async function areConnected(a: string, b: string): Promise<boolean> {
  const row = await prisma.connection.findFirst({
    where: { OR: [{ fromUserId: a, toUserId: b }, { fromUserId: b, toUserId: a }] },
    select: { id: true },
  });
  return Boolean(row);
}

/** A pair of user ids in the order conversations store them. */
export const pairKey = (a: string, b: string) => (a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a });

type ConversationSides = { userAId: string; userBId: string; aLastReadAt: Date | null; bLastReadAt: Date | null };

/** The other person's id and when I last read the chat. */
export function mySide(conversation: ConversationSides, meId: string) {
  const iAmA = conversation.userAId === meId;
  return {
    otherId: iAmA ? conversation.userBId : conversation.userAId,
    lastReadAt: iAmA ? conversation.aLastReadAt : conversation.bLastReadAt,
    readField: iAmA ? ("aLastReadAt" as const) : ("bLastReadAt" as const),
  };
}

/** Messages from the other person that arrived after I last opened the chat. */
export function countUnread(conversation: ConversationSides & { id: string }, meId: string): Promise<number> {
  const { lastReadAt } = mySide(conversation, meId);
  return prisma.message.count({
    where: { conversationId: conversation.id, senderId: { not: meId }, ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}) },
  });
}

/** The user's conversations with unread counts; only chats with something newer than the last read are counted. */
export async function conversationsWithUnread(meId: string) {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ userAId: meId }, { userBId: meId }] },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
  });
  return Promise.all(
    rows.map(async (row) => {
      const { lastReadAt } = mySide(row, meId);
      const mayHaveUnread = !lastReadAt || row.lastMessageAt > lastReadAt;
      return { row, unread: mayHaveUnread ? await countUnread(row, meId) : 0 };
    }),
  );
}
