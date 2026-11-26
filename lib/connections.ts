// Server helpers for connections and chat (Chat page). Connections are one-way follow rows that
// start "pending" and become "accepted" when the person followed says yes.

import { prisma } from "@/lib/db";
import { ringStyleOf } from "@/lib/theme-color";
import { CONNECTION_KINDS, type ConnectionKind, type Person, type UserRole } from "@/lib/types";

/** How recently someone must have had the app open to count as online. The app checks in every 30 seconds. */
export const ONLINE_WINDOW_MS = 90_000;

/** Online: seen within the last 90 seconds. */
export const isOnline = (lastSeenAt: Date | null | undefined, now = Date.now()) => Boolean(lastSeenAt && now - lastSeenAt.getTime() < ONLINE_WINDOW_MS);

/**
 * Marks the user as in the app. Writes at most every 30 seconds per user, so the menu's poll
 * doesn't turn into a database write each time.
 */
export async function touchPresence(userId: string) {
  const cutoff = new Date(Date.now() - 30_000);
  await prisma.user.updateMany({ where: { id: userId, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }] }, data: { lastSeenAt: new Date() } });
}

type UserBits = { id: string; name: string; role: string };

export const isConnectionKind = (value: unknown): value is ConnectionKind => CONNECTION_KINDS.includes(value as ConnectionKind);

/** Counts of accepted followers and following for each user id. */
export async function followCounts(ids: string[]) {
  const [followers, following] = await Promise.all([
    prisma.connection.groupBy({ by: ["toUserId"], where: { toUserId: { in: ids }, status: "accepted" }, _count: { _all: true } }),
    prisma.connection.groupBy({ by: ["fromUserId"], where: { fromUserId: { in: ids }, status: "accepted" }, _count: { _all: true } }),
  ]);
  return {
    followers: new Map(followers.map((r) => [r.toUserId, r._count._all])),
    following: new Map(following.map((r) => [r.fromUserId, r._count._all])),
  };
}

/** Turns users into People as seen by `meId`: how I follow each, whether they follow me, and their public counts. */
export async function toPeople(meId: string, users: UserBits[]): Promise<Person[]> {
  if (!users.length) return [];
  const ids = users.map((u) => u.id);
  const [mine, theirs, counts, looks] = await Promise.all([
    prisma.connection.findMany({ where: { fromUserId: meId, toUserId: { in: ids } }, select: { toUserId: true, kind: true, status: true } }),
    prisma.connection.findMany({ where: { toUserId: meId, fromUserId: { in: ids } }, select: { fromUserId: true, status: true } }),
    followCounts(ids),
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, avatarUrl: true, profilePictureUrl: true, ringStyle: true, lastSeenAt: true } }),
  ]);
  const out = new Map(mine.map((c) => [c.toUserId, c]));
  const back = new Map(theirs.map((c) => [c.fromUserId, c.status]));
  const look = new Map(looks.map((l) => [l.id, l]));
  const now = Date.now();
  return users.map((u) => {
    const l = look.get(u.id);
    const row = out.get(u.id);
    const accepted = row?.status === "accepted";
    return {
      id: u.id,
      name: u.name,
      role: (u.role === "EMPLOYER" ? "EMPLOYER" : "SEEKER") as UserRole,
      connection: accepted ? (isConnectionKind(row.kind) ? row.kind : "other") : null,
      requested: row?.status === "pending",
      connectedToMe: back.get(u.id) === "accepted",
      requestedMe: back.get(u.id) === "pending",
      followers: counts.followers.get(u.id) ?? 0,
      following: counts.following.get(u.id) ?? 0,
      photoUrl: l?.avatarUrl ?? l?.profilePictureUrl ?? null,
      ring: ringStyleOf(l?.ringStyle),
      online: isOnline(l?.lastSeenAt, now),
    };
  });
}

/** True when either user follows the other (accepted), which is what allows them to chat. */
export async function areConnected(a: string, b: string): Promise<boolean> {
  const row = await prisma.connection.findFirst({
    where: { status: "accepted", OR: [{ fromUserId: a, toUserId: b }, { fromUserId: b, toUserId: a }] },
    select: { id: true },
  });
  return Boolean(row);
}

/** Makes two users follow each other, accepted both ways (used by invite links). Existing kinds are kept. */
export async function connectBothWays(a: string, b: string, kind: ConnectionKind = "friend") {
  if (a === b) return;
  await prisma.$transaction([
    prisma.connection.upsert({ where: { fromUserId_toUserId: { fromUserId: a, toUserId: b } }, create: { fromUserId: a, toUserId: b, kind, status: "accepted" }, update: { status: "accepted" } }),
    prisma.connection.upsert({ where: { fromUserId_toUserId: { fromUserId: b, toUserId: a } }, create: { fromUserId: b, toUserId: a, kind, status: "accepted" }, update: { status: "accepted" } }),
  ]);
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
