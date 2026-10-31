import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

// Always succeeds, even without a session, so the client can call it unconditionally.
export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
