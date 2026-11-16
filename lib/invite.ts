import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no look-alikes (l/1, o/0)

function newCode(): string {
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** The user's invite code, made the first time it's asked for. */
export async function inviteCodeFor(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { inviteCode: true } });
  if (user?.inviteCode) return user.inviteCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    // Only sets it if no other request has set one meanwhile.
    const { count } = await prisma.user.updateMany({ where: { id: userId, inviteCode: null }, data: { inviteCode: code } }).catch(() => ({ count: 0 }));
    if (count) return code;
    const again = await prisma.user.findUnique({ where: { id: userId }, select: { inviteCode: true } });
    if (again?.inviteCode) return again.inviteCode;
  }
  throw new Error("Couldn't make an invite code");
}

/** The user an invite code belongs to, or null. */
export async function inviterFor(code: unknown): Promise<{ id: string; name: string } | null> {
  if (typeof code !== "string" || !/^[a-z0-9]{6,20}$/.test(code)) return null;
  return prisma.user.findUnique({ where: { inviteCode: code }, select: { id: true, name: true } });
}

/** Holds the invite code between opening an invite link and signing up or logging in. */
export const INVITE_COOKIE = "invite";
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** Reads the invite cookie from a request's Cookie header. */
export function inviteCodeFromRequest(request: Request): string | null {
  const match = /(?:^|;\s*)invite=([a-z0-9]{6,20})(?:;|$)/.exec(request.headers.get("cookie") ?? "");
  return match ? match[1] : null;
}

/**
 * If the request carries an invite code, connects the new or logged-in user with whoever invited
 * them (both ways, accepted). Never fails the sign-up or login it's part of.
 */
export async function acceptInviteFromRequest(request: Request, userId: string): Promise<boolean> {
  try {
    const inviter = await inviterFor(inviteCodeFromRequest(request));
    if (!inviter || inviter.id === userId) return false;
    const { connectBothWays } = await import("@/lib/connections");
    await connectBothWays(inviter.id, userId);
    return true;
  } catch (error) {
    console.error("accepting invite failed", error);
    return false;
  }
}
