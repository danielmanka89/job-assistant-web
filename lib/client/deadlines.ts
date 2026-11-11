import type { DeadlineItem, DeadlineKind, DeadlineListResponse } from "@/lib/types";

// Parsers for the deadlines endpoints. A malformed item is skipped instead of breaking the tracker.

const KINDS: DeadlineKind[] = ["interview", "follow_up", "learning", "custom"];

/** One tracker item from an API body, or null if it isn't usable. */
export function toDeadlineItem(body: unknown): DeadlineItem | null {
  const b = body as Partial<Record<keyof DeadlineItem, unknown>> | null;
  if (!b || typeof b.id !== "string" || typeof b.title !== "string" || !KINDS.includes(b.kind as DeadlineKind)) return null;
  return {
    id: b.id,
    kind: b.kind as DeadlineKind,
    title: b.title,
    detail: typeof b.detail === "string" ? b.detail : "",
    dueOn: typeof b.dueOn === "string" ? b.dueOn : null,
    progress: typeof b.progress === "number" ? b.progress : null,
    done: b.done === true,
    href: typeof b.href === "string" && b.href.startsWith("/") ? b.href : null,
  };
}

/** Body of GET /api/deadlines. */
export function toDeadlineList(body: unknown): DeadlineItem[] {
  const list = (body as Partial<DeadlineListResponse> | null)?.items;
  return Array.isArray(list) ? list.map(toDeadlineItem).filter((i): i is DeadlineItem => i !== null) : [];
}
