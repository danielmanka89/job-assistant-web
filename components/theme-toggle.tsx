"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { THEME_STORAGE_KEY, THEMES } from "@/lib/theme-init";

// The choice lives in this browser only. THEME_INIT_SCRIPT (lib/theme-init.ts) applies it before
// the first paint so the page doesn't flash the wrong theme on load. With no choice saved, the site
// follows the device's light/dark setting (see globals.css).
const KEY = THEME_STORAGE_KEY;
const CHANGE_EVENT = "job-assistant:theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

type Theme = (typeof THEMES)[number];
const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);


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
 * Keeps this tab in step when the theme is switched in another tab. Shows nothing; it sits in the
 * root layout so every page listens, not just Settings.
 */
export function ThemeSync() {
  useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);
  return null;
}

/**
 * Light / Dark / Black & White picker for the Settings page. The choice applies at once and is kept
 * in this browser. Nothing is selected until the page has loaded, since the server can't know it.
 */
export function ThemePicker() {
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);
  // Set only on a change, so screen readers hear it but nothing is announced on page load.
  const [announcement, setAnnouncement] = useState("");

  return (
    <>
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">Appearance</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map((option) => {
            const selected = theme === option.theme;
            return (
              <label
                key={option.theme}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/30 ${
                  selected
                    ? "border-brand-600 bg-brand-50/60 dark:border-brand-500 dark:bg-brand-500/10"
                    : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
                }`}
              >
                <input
                  type="radio"
                  name="appearance"
                  value={option.theme}
                  checked={selected}
                  onChange={() => {
                    choose(option.theme);
                    setAnnouncement(`${option.label} theme`);
                  }}
                  className="sr-only"
                />
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-800 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  aria-hidden="true"
                >
                  {option.icon}
                </span>
                <span className="min-w-0 font-semibold text-neutral-900 dark:text-white">{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}

/**
 * The sun/moon switch: one tap between Light and Dark (Settings also has Black & White and "follow
 * my device"). It wears the theme it is in: light grays in light, dark grays in dark, with the knob
 * on the sun or the moon. Black & White counts as light here.
 */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={dark ? "Switch to light" : "Switch to dark"}
      onClick={() => choose(dark ? "light" : "dark")}
      className={`relative h-11 w-[5.5rem] shrink-0 rounded-full border border-neutral-300/80 bg-neutral-200/80 shadow-[inset_0_2px_4px_rgb(0_0_0/0.08)] outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40 dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-[inset_0_2px_5px_rgb(0_0_0/0.5)] ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-neutral-500">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true" className="absolute top-1/2 right-3 size-[17px] -translate-y-1/2 text-neutral-500">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
      </svg>
      {/* The knob: white with a dark sun in light, charcoal with a light moon in dark. */}
      <span
        aria-hidden="true"
        className={`absolute top-[4px] grid size-[34px] place-items-center rounded-full transition-[left] duration-300 motion-reduce:transition-none ${
          dark
            ? "left-[calc(100%-38px)] border border-white/15 bg-[linear-gradient(180deg,#4a4d53,#2a2c30)] text-neutral-100 shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_3px_8px_rgb(0_0_0/0.5)]"
            : "left-[4px] border border-neutral-300 bg-[linear-gradient(180deg,#ffffff,#e4e6e8)] text-neutral-800 shadow-[inset_0_1px_0_#fff,0_3px_8px_rgb(0_0_0/0.15)]"
        }`}
      >
        {dark ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]">
            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-[18px]">
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </svg>
        )}
      </span>
    </button>
  );
}
