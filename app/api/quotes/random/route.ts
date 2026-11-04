import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quoteSlot } from "@/lib/quote-rotation";
import type { RandomQuoteResponse } from "@/lib/types";

/**
 * GET /api/quotes/random — the motivational quote for the dashboard banner. It depends only on the
 * server's clock, so everyone sees the same quote at the same moment: the next one in a shuffled
 * cycle of all quotes, changing on every 15-second mark, so none repeats within an hour.
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

  const response = NextResponse.json<RandomQuoteResponse>({
    quote,
    serverTime: new Date(now).toISOString(),
    nextChangeAt: new Date(nextChangeAt).toISOString(),
  });
  // Never cached: serverTime must be fresh, or a reused answer would time the next change late.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
