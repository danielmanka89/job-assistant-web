import type { KeyboardEvent } from "react";

/**
 * Keyboard support for a row of role="tab" buttons: arrow keys, Home and End select the next tab and
 * move focus to it. Give the selected tab tabIndex 0 and the others -1, so the row is one Tab stop.
 */
export function tabListKeyDown<T extends string>(
  event: KeyboardEvent,
  keys: readonly T[],
  current: T,
  select: (key: T) => void,
  idOf: (key: T) => string,
) {
  const index = keys.indexOf(current);
  const last = keys.length - 1;
  let to: number | null = null;
  if (event.key === "ArrowRight") to = index === last ? 0 : index + 1;
  else if (event.key === "ArrowLeft") to = index === 0 ? last : index - 1;
  else if (event.key === "Home") to = 0;
  else if (event.key === "End") to = last;
  if (to === null) return;
  event.preventDefault();
  select(keys[to]);
  document.getElementById(idOf(keys[to]))?.focus();
}

/** True when keyboard focus fell back to the page, because the focused element was removed or hidden. */
export function focusLost() {
  return !document.activeElement || document.activeElement === document.body;
}

/** Focuses the first element found by id, for putting focus back after a panel closes. */
export function focusFirst(...ids: string[]) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el.focus();
  }
}
