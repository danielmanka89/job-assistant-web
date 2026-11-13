"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/types";
import { getRandomQuote } from "@/lib/client/api";
import { QUOTE_INTERVAL_MS } from "@/lib/quote-rotation";

const FADE_MS = 300;

/**
 * Slim frosted-glass bar floating at the bottom of every dashboard page with a motivational quote. Every
 * user sees the same quote at the same time; it changes on each 15-second mark of the server's clock
 * (the text cross-fades). It can be paused, and it stops asking while the tab is hidden.
 */
export function QuoteBanner() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  // The progress line is keyed to the quote and starts part-way through when a page opens mid-quote.
  const [progress, setProgress] = useState({ key: 0, elapsedMs: 0 });
  const pausedRef = useRef(paused);
  const shownId = useRef<number | null>(null);
  const resync = useRef<() => void>(() => {});

  useEffect(() => {
    let live = true;
    let next: number | undefined;
    let fade: number | undefined;

    // Everyone gets the same quote at the same moment: the server picks it from its own clock, and the
    // next request is timed by the server's countdown (nextChangeAt - serverTime), not this device's
    // clock, which may be off by seconds.
    async function load() {
      window.clearTimeout(next);
      const result = await getRandomQuote();
      if (!live) return;
      if (!result.ok) {
        next = window.setTimeout(tick, 5000); // keep showing the last quote and try again shortly
        return;
      }
      const { quote: latest, serverTime, nextChangeAt } = result.data;
      const untilNext = Math.max(0, Date.parse(nextChangeAt) - Date.parse(serverTime));
      next = window.setTimeout(tick, untilNext + 250);
      if (latest.id === shownId.current) return;

      const first = shownId.current === null;
      shownId.current = latest.id;
      const elapsedMs = QUOTE_INTERVAL_MS - untilNext;
      if (first) {
        setQuote(latest);
        setVisible(true);
        setProgress({ key: latest.id, elapsedMs });
        return;
      }
      setVisible(false); // fade out, swap, fade in
      fade = window.setTimeout(() => {
        if (!live) return;
        setQuote(latest);
        setVisible(true);
        setProgress({ key: latest.id, elapsedMs: elapsedMs + FADE_MS });
      }, FADE_MS);
    }

    // Paused or in a background tab: stop asking; resuming or coming back catches up at once.
    function tick() {
      if (!pausedRef.current && !document.hidden) void load();
    }
    resync.current = tick;
    document.addEventListener("visibilitychange", tick);
    void load();

    return () => {
      live = false;
      window.clearTimeout(next);
      window.clearTimeout(fade);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) resync.current(); // back in step with everyone else straight away
  }, [paused]);

  return (
    <footer
      data-quote-banner
      aria-label="Motivational quote"
      // A frosted-glass strip flush with the bottom of the window: no gap at the bottom, left or right
      // (from lg up it runs from the menu to the frame; the frame's rounded corner trims its end).
      className="fixed inset-x-0 bottom-0 z-30 h-(--quote-banner-h) overflow-hidden border-t border-white/70 bg-white/70 backdrop-blur-xl backdrop-saturate-150 lg:right-(--edge) lg:bottom-(--edge) lg:left-[calc(var(--edge)+18rem)] dark:border-white/10 dark:bg-neutral-900/70"
    >
      {/* The top edge doubles as the progress line: it fills in red until the next quote. */}
      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-white/50 dark:bg-white/10" aria-hidden="true">
        {quote && !paused && (
          <span
            key={progress.key}
            style={{ animationDelay: `-${progress.elapsedMs}ms` }}
            className="block h-full origin-left animate-quote-progress bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 shadow-[0_0_6px_rgb(var(--brand-glow)/0.6)] motion-reduce:hidden"
          />
        )}
      </div>

      <div className="mx-auto flex h-full max-w-6xl items-center gap-2.5 px-4 sm:px-6">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-sm shadow-brand-600/30" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
            <path d="M9.6 6C6.5 7.4 4.5 10.2 4.5 13.6V18h5.3v-5.3H7.2c.1-2 1.3-3.6 3.3-4.6L9.6 6Zm9 0c-3.1 1.4-5.1 4.2-5.1 7.6V18h5.3v-5.3h-2.6c.1-2 1.3-3.6 3.3-4.6L18.6 6Z" />
          </svg>
        </span>

        {/* The banner never moves; only the text cross-fades. Not a live region: a new quote every
            15 seconds would keep interrupting screen readers. */}
        <figure
          className={`flex min-w-0 flex-1 flex-col transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none sm:flex-row sm:items-baseline sm:gap-2 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-0.5 opacity-0"
          }`}
        >
          {quote ? (
            <>
              {/* One line; the full quote is in the tooltip when a long one is cut off. */}
              <blockquote title={quote.text} className="min-w-0 truncate text-xs font-medium text-neutral-800 sm:text-[13px] dark:text-neutral-100">
                &ldquo;{quote.text}&rdquo;
              </blockquote>
              {quote.author && (
                <figcaption className="shrink-0 truncate text-[10px] font-semibold tracking-wider text-brand-600 uppercase sm:text-[11px] dark:text-brand-400">
                  {quote.author}
                </figcaption>
              )}
            </>
          ) : (
            <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />
          )}
        </figure>

        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? "Resume quotes" : "Pause quotes"}
          title={paused ? "Resume quotes" : "Pause quotes"}
          className="grid size-7 shrink-0 place-items-center rounded-full text-neutral-500 transition hover:bg-white/60 hover:text-brand-600 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
        >
          {paused ? (
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
              <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.34-5.89a1.5 1.5 0 0 0 0-2.54L6.3 2.84Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
              <path d="M5.75 3a.75.75 0 0 0-.75.75v12.5c0 .41.34.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 7.25 3h-1.5ZM12.75 3a.75.75 0 0 0-.75.75v12.5c0 .41.34.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-1.5Z" />
            </svg>
          )}
        </button>
      </div>
    </footer>
  );
}
