import { createHmac, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Sessions live in the Session table. The cookie holds a random token; the table stores only its
// HMAC, so a copy of the database can't be turned back into working cookies.

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return secret;
}

function hashToken(token: string): string {
  return createHmac("sha256", getSecret()).update(token).digest("hex");
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Creates a session for the user and sets its cookie on the response. */
export async function createSession(response: NextResponse, userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await prisma.$transaction([
    // Tidy up this user's expired sessions while we're here.
    prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date(now) } } }),
    prisma.session.create({
      data: { tokenHash: hashToken(token), userId, expiresAt: new Date(now + SESSION_MAX_AGE_SECONDS * 1000) },
    }),
  ]);
  response.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_MAX_AGE_SECONDS });
}

/** Returns the user id for a valid, unexpired session token, or null. */
export async function findSessionUserId(token: string | undefined): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.userId;
}

/** Deletes the session behind a token, if there is one. The token stops working immediately. */
export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token || token.length > 200) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Expires the session cookie on a response. */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}
