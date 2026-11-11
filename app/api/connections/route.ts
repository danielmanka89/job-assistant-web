import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { isConnectionKind, toPeople } from "@/lib/connections";
import { prisma } from "@/lib/db";
import type { ConnectionsResponse, Person } from "@/lib/types";

const MAX_CONNECTIONS = 2000; // per user, in each direction shown

const person = { select: { id: true, name: true, role: true } };

/** GET /api/connections — the people you're connected to, and the people connected to you, newest first. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your connections");

  const [from, to] = await Promise.all([
    prisma.connection.findMany({ where: { fromUserId: user.id }, orderBy: { createdAt: "desc" }, take: MAX_CONNECTIONS, select: { toUser: person } }),
    prisma.connection.findMany({ where: { toUserId: user.id }, orderBy: { createdAt: "desc" }, take: MAX_CONNECTIONS, select: { fromUser: person } }),
  ]);
  const [connectedTo, connectedToMe] = await Promise.all([
    toPeople(user.id, from.map((c) => c.toUser)),
    toPeople(user.id, to.map((c) => c.fromUser)),
  ]);
  return NextResponse.json<ConnectionsResponse>({ connectedTo, connectedToMe });
}

/** POST /api/connections { userId, kind } — connects you to someone, or changes what they are to you. */
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
    create: { fromUserId: user.id, toUserId: userId, kind },
    update: { kind },
  });
  const [result] = await toPeople(user.id, [other]);
  return NextResponse.json<Person>(result, { status: existing ? 200 : 201 });
}
