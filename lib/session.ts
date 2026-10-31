import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

// Session = HMAC-signed cookie "<payload>.<signature>", where payload is base64url JSON { uid, exp }.

export const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  uid: string; // user id
  exp: number; // expiry, seconds since epoch
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

/** Sets the HTTP-only session cookie for the given user on a response. */
export function setSessionCookie(response: NextResponse, userId: string): void {
  const payload: SessionPayload = { uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  response.cookies.set(SESSION_COOKIE, `${encoded}.${sign(encoded)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Returns the user id from a valid, unexpired session cookie, or null. */
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload.uid : null;
  } catch {
    return null;
  }
}
