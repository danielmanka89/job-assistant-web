import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getPublicPortfolio } from "@/lib/public-portfolio";
import type { PublicPortfolio } from "@/lib/types";

type Context = { params: Promise<{ userId: string }> };

/**
 * GET /api/profile/public/:userId — a candidate's public portfolio. No login needed, so recruiters
 * can open a shared link. 404 unless the candidate approved sharing; never cached, so making the
 * portfolio private again takes effect at once.
 */
export async function GET(_request: Request, { params }: Context) {
  const { userId } = await params;
  const portfolio = await getPublicPortfolio(userId);
  if (!portfolio) return apiError(404, "PORTFOLIO_NOT_FOUND", "This portfolio isn't public");
  return NextResponse.json<PublicPortfolio>(portfolio, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
