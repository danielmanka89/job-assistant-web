import { NextResponse, type NextRequest } from "next/server";
import { connectBothWays } from "@/lib/connections";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, inviterFor } from "@/lib/invite";
import { SESSION_COOKIE, findSessionUserId } from "@/lib/session";

/**
 * GET /invite/:code — someone opened a friend's invite link. Logged in: they're connected right
 * away and land in Chat. Otherwise the code is kept in a cookie and they go to sign up; it's used
 * when they create an account (or log in instead).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toLowerCase();
  const inviter = await inviterFor(code);
  if (!inviter) return NextResponse.redirect(new URL("/register", request.url));

  const userId = await findSessionUserId(request.cookies.get(SESSION_COOKIE)?.value);
  if (userId) {
    if (userId !== inviter.id) await connectBothWays(inviter.id, userId);
    return NextResponse.redirect(new URL("/dashboard/chat", request.url));
  }

  const response = NextResponse.redirect(new URL(`/register?invite=${code}`, request.url));
  response.cookies.set(INVITE_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE,
  });
  return response;
}
