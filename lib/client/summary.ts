// Client-side contract for the AI summary generator.
// The backend endpoint isn't in lib/types.ts yet, so these shapes live here until
// Daniel adds the shared types; then this file should import them instead.

/** Input for POST /api/summary-generate. */
export interface SummaryGenerateRequest {
  resumeId: string;
  gapAnalysisId: string;
}

export interface SummaryOption {
  id: string;
  text: string;
}

/** Input for saving the chosen summary with PATCH /api/resumes/:id. */
export interface SaveSummaryRequest {
  summary: string;
}

/**
 * Reads the options from a POST /api/summary-generate response.
 * Accepts `{ options: [...] }` or a bare array, with each option either
 * `{ id, text }` or a plain string, so small contract changes don't break the page.
 */
export function toSummaryOptions(body: unknown): SummaryOption[] {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { options?: unknown }).options)
      ? (body as { options: unknown[] }).options
      : [];

  return list
    .map((item, i): SummaryOption | null => {
      if (typeof item === "string") return { id: `option_${i + 1}`, text: item.trim() };
      if (item && typeof item === "object") {
        const { id, text, summary } = item as { id?: unknown; text?: unknown; summary?: unknown };
        const value = typeof text === "string" ? text : typeof summary === "string" ? summary : "";
        return { id: typeof id === "string" && id ? id : `option_${i + 1}`, text: value.trim() };
      }
      return null;
    })
    .filter((o): o is SummaryOption => o !== null && o.text.length > 0);
}
