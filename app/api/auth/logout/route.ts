import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clearSessionCookie, deleteSession } from "@/lib/session";

// Always succeeds, even without a session, so the client can call it unconditionally.
// Deleting the row means a copy of the cookie stops working too.
export async function POST(request: NextRequest) {
  await deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
