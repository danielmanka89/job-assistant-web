import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isConnectionKind, toPeople } from "@/lib/connections";
import { prisma } from "@/lib/db";
import type { ConnectionsResponse, Person } from "@/lib/types";

const MAX_CONNECTIONS = 2000; // per user, in each direction shown

const person = { select: { id: true, name: true, role: true } };

/**
 * GET /api/connections — your own lists, newest first: who you follow, your followers, and requests
 * waiting for your answer. Only you can see these; other people see just the counts.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your connections");

  const newest = { orderBy: { createdAt: "desc" as const }, take: MAX_CONNECTIONS };
  const [from, to, pending] = await Promise.all([
    prisma.connection.findMany({ where: { fromUserId: user.id, status: "accepted" }, ...newest, select: { toUser: person } }),
    prisma.connection.findMany({ where: { toUserId: user.id, status: "accepted" }, ...newest, select: { fromUser: person } }),
    prisma.connection.findMany({ where: { toUserId: user.id, status: "pending" }, ...newest, select: { fromUser: person } }),
  ]);
  const [connectedTo, connectedToMe, requests] = await Promise.all([
    toPeople(user.id, from.map((c) => c.toUser)),
    toPeople(user.id, to.map((c) => c.fromUser)),
    toPeople(user.id, pending.map((c) => c.fromUser)),
  ]);
  return NextResponse.json<ConnectionsResponse>({ connectedTo, connectedToMe, requests });
}

/**
 * POST /api/connections { userId, kind } — asks to follow someone (pending until they accept), or
 * changes what they are to you. A request that's already waiting stays waiting.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to connect with people");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const { userId, kind } = body;
  const fieldErrors: Record<string, string> = {};
  if (typeof userId !== "string" || !userId || userId.length > 100) fieldErrors.userId = "Must be a user id";
  else if (userId === user.id) fieldErrors.userId = "You can't connect to yourself";
  if (!isConnectionKind(kind)) fieldErrors.kind = "Choose what this person is to you";
  if (Object.keys(fieldErrors).length || typeof userId !== "string" || !isConnectionKind(kind)) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);
  }

  const other = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } });
  if (!other) return apiError(404, "USER_NOT_FOUND", "That person's account no longer exists");

  const existing = await prisma.connection.findUnique({ where: { fromUserId_toUserId: { fromUserId: user.id, toUserId: userId } } });
  if (!existing && (await prisma.connection.count({ where: { fromUserId: user.id } })) >= MAX_CONNECTIONS) {
    return apiError(409, "TOO_MANY_CONNECTIONS", `You can be connected to up to ${MAX_CONNECTIONS} people.`);
  }
  await prisma.connection.upsert({
    where: { fromUserId_toUserId: { fromUserId: user.id, toUserId: userId } },
    create: { fromUserId: user.id, toUserId: userId, kind, status: "pending" },
    update: { kind },
  });
  const [result] = await toPeople(user.id, [other]);
  return NextResponse.json<Person>(result, { status: existing ? 200 : 201 });
}
