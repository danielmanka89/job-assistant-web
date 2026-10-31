import type { NextRequest } from "next/server";
import type { User as UserRow } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/** Returns the logged-in user for a request, or null if the session is missing or invalid. */
export async function getSessionUser(request: NextRequest): Promise<UserRow | null> {
  const userId = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  return userId ? prisma.user.findUnique({ where: { id: userId } }) : null;
}
