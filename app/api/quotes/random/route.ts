import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quoteSlot } from "@/lib/quote-rotation";
import type { RandomQuoteResponse } from "@/lib/types";

/**
 * GET /api/quotes/random — a motivational quote for the dashboard banner: the next one in a shuffled
 * cycle of all quotes, changing every 15 seconds, so none repeats within an hour.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see quotes");

  const count = await prisma.quote.count();
  if (!count) return apiError(404, "NO_QUOTES", "No quotes yet");

  const now = Date.now();
  const { index, nextChangeAt } = quoteSlot(now, count);
  const quote = await prisma.quote.findFirst({ orderBy: { id: "asc" }, skip: index, select: { id: true, text: true, author: true } });
  if (!quote) return apiError(404, "NO_QUOTES", "No quotes yet");

  const response = NextResponse.json<RandomQuoteResponse>({ quote, nextChangeAt: new Date(nextChangeAt).toISOString() });
  // Same answer until the next change, so the browser may reuse it until then.
  response.headers.set("Cache-Control", `private, max-age=${Math.max(0, Math.floor((nextChangeAt - now) / 1000))}`);
  return response;
}
