"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

// The choice lives in this browser only. THEME_INIT_SCRIPT applies it before the first paint
// so the page doesn't flash the wrong theme on load. With no choice saved, the site follows
// the device's light/dark setting (see globals.css).
const KEY = "job-assistant.theme";
const CHANGE_EVENT = "job-assistant:theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

type Theme = "light" | "dark" | "mono";
const THEMES: readonly Theme[] = ["light", "dark", "mono"];
const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(KEY)});if(${JSON.stringify(THEMES)}.indexOf(t)>=0)document.documentElement.dataset.theme=t}catch(e){}`;

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    apply(isTheme(event.newValue) ? event.newValue : null); // another tab switched
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

/** The theme on screen: the saved choice, or light/dark from the device when there is none. */
function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (isTheme(chosen)) return chosen;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function apply(theme: Theme | null) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function choose(theme: Theme) {
  apply(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage unavailable: the theme still switches for this page view.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const ICON = "size-5 shrink-0";
const OPTIONS: { theme: Theme; label: string; icon: ReactNode }[] = [
  {
    theme: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    theme: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    theme: "mono",
    label: "Black & White",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

/**
 * Round button pinned to the top-right corner. Each click moves to the next theme:
 * Light → Dark → Black & White → Light. The icon shows the theme on screen now.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);
  // Set only on click, so screen readers hear the change but nothing is announced on page load.
  const [announcement, setAnnouncement] = useState("");
  const index = OPTIONS.findIndex((o) => o.theme === theme);
  const current = OPTIONS[index];
  const next = OPTIONS[(index + 1) % OPTIONS.length];

  function cycle() {
    choose(next.theme);
    setAnnouncement(`${next.label} theme`);
  }

  return (
    <>
      <button
        type="button"
        onClick={cycle}
        // The accessible name stays the same on every click; the live region below says what changed.
        aria-label="Theme"
        title={current ? `Theme: ${current.label} (click for ${next.label})` : "Theme"}
        className="fixed top-3 right-3 z-[60] grid size-10 place-items-center rounded-full border border-neutral-200 bg-white/90 text-neutral-800 shadow-md backdrop-blur transition outline-none hover:border-neutral-300 hover:bg-white focus-visible:ring-4 focus-visible:ring-brand-500/30 active:scale-95 dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-100 dark:hover:border-neutral-500 dark:hover:bg-neutral-900"
      >
        {current?.icon ?? <span className="size-5" aria-hidden="true" />}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
