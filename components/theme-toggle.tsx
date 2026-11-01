"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

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

/** Round button pinned to the top-right corner; opens a menu to pick Light, Dark or Black & White. */
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = OPTIONS.find((o) => o.theme === theme);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="fixed top-3 right-3 z-[60]">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="theme-menu"
        // The accessible name stays the same (aria-pressed on each option carries the choice); the tooltip shows it.
        aria-label="Theme"
        title={current ? `Theme: ${current.label}` : "Theme"}
        className="grid size-10 place-items-center rounded-full border border-neutral-200 bg-white/90 text-neutral-800 shadow-md backdrop-blur transition outline-none hover:border-neutral-300 hover:bg-white focus-visible:ring-4 focus-visible:ring-brand-500/30 dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-100 dark:hover:border-neutral-500 dark:hover:bg-neutral-900"
      >
        {current?.icon ?? <span className="size-5" aria-hidden="true" />}
      </button>

      {open && (
        <div
          id="theme-menu"
          role="group"
          aria-label="Theme"
          className="absolute top-12 right-0 w-52 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        >
          <p className="px-3 pt-1.5 pb-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
            Theme
          </p>
          {OPTIONS.map((option) => {
            const selected = option.theme === theme;
            return (
              <button
                key={option.theme}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  choose(option.theme);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                  selected
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                {option.icon}
                <span className="flex-1 whitespace-nowrap">{option.label}</span>
                {selected && (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
