import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { toPeople } from "@/lib/connections";
import { prisma } from "@/lib/db";
import type { PeopleSearchResponse } from "@/lib/types";

/**
 * GET /api/people?q= — finds other users to connect with: names containing q (2+ characters), or
 * the user whose email is exactly q. Emails are never returned, and can't be found by a partial match.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to find people");

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json<PeopleSearchResponse>({ people: [] });

  const users = await prisma.user.findMany({
    where: { id: { not: user.id }, OR: [{ name: { contains: q, mode: "insensitive" } }, { email: q.toLowerCase() }] },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  return NextResponse.json<PeopleSearchResponse>({ people: await toPeople(user.id, users) });
}
