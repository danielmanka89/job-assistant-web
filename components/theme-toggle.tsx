"use client";

import { useSyncExternalStore } from "react";

// The choice lives in this browser only. THEME_INIT_SCRIPT applies it before the first paint
// so the page doesn't flash red on load.
const KEY = "job-assistant.theme";
const CHANGE_EVENT = "job-assistant:theme-change";

export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(KEY)})==="mono")document.documentElement.dataset.theme="mono"}catch(e){}`;

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    apply(event.newValue === "mono"); // another tab switched
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const isMono = () => document.documentElement.dataset.theme === "mono";

function apply(mono: boolean) {
  if (mono) document.documentElement.dataset.theme = "mono";
  else delete document.documentElement.dataset.theme;
}

function setMono(mono: boolean) {
  apply(mono);
  try {
    if (mono) localStorage.setItem(KEY, "mono");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: the theme still switches for this page view.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Round button pinned to the top-right corner that switches between the red and the black & white theme. */
export function ThemeToggle() {
  const mono = useSyncExternalStore(subscribe, isMono, () => false);
  // aria-pressed carries the state, so the accessible name stays the same either way.
  const hint = mono ? "Switch to red theme" : "Switch to black & white theme";

  return (
    <button
      type="button"
      onClick={() => setMono(!mono)}
      aria-pressed={mono}
      aria-label="Black & white theme"
      title={hint}
      className="fixed top-3 right-3 z-[60] grid size-10 place-items-center rounded-full border border-neutral-200 bg-white/90 text-neutral-800 shadow-md backdrop-blur transition outline-none hover:border-neutral-300 hover:bg-white focus-visible:ring-4 focus-visible:ring-brand-500/30 dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-100 dark:hover:border-neutral-500 dark:hover:bg-neutral-900"
    >
      {/* Half-filled circle: the usual "contrast" icon. The filled half flips with the theme. */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d={mono ? "M12 3.5a8.5 8.5 0 0 0 0 17Z" : "M12 3.5a8.5 8.5 0 0 1 0 17Z"} fill="currentColor" stroke="none" />
      </svg>
      {!mono && (
        <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-brand-600 ring-2 ring-white dark:ring-neutral-900" aria-hidden="true" />
      )}
    </button>
  );
}
