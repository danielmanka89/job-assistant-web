import type { TailoredResumeResponse } from "@/lib/types";

/**
 * The match score of the generated file, from POST /api/tailor's `finalMatchPercent`.
 * It isn't in lib/types.ts yet, so this reads it from the top of the response or from
 * `tailoredResume`, and returns null when it's missing or not a valid percentage
 * (older stored results, or a backend without the field).
 */
export function readFinalMatchPercent(response: TailoredResumeResponse): number | null {
  const top = (response as { finalMatchPercent?: unknown }).finalMatchPercent;
  const nested = (response.tailoredResume as { finalMatchPercent?: unknown } | undefined)?.finalMatchPercent;
  const value = typeof top === "number" ? top : nested;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) return null;
  return Math.round(value);
}
