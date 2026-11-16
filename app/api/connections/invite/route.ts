import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { inviteCodeFor } from "@/lib/invite";
import type { InviteLinkResponse } from "@/lib/types";

/**
 * GET /api/connections/invite — your personal invite link. Anyone who signs up (or logs in) from it
 * follows you and you follow them, both accepted, so you can chat straight away.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to get your invite link");
  const code = await inviteCodeFor(user.id);
  return NextResponse.json<InviteLinkResponse>({ url: `${request.nextUrl.origin}/invite/${code}` });
}
