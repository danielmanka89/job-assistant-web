"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/types";
import { getRandomQuote } from "@/lib/client/api";
import { QUOTE_INTERVAL_MS } from "@/lib/quote-rotation";

const FADE_MS = 300;

/**
 * Slim bar fixed to the bottom of every dashboard page with a motivational quote that changes every
 * 15 seconds (the text cross-fades). It can be paused, and it stops asking while the tab is hidden.
 */
export function QuoteBanner() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0); // restarts the progress line on each change
  const pausedRef = useRef(paused);
  const shownId = useRef<number | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    let live = true;
    let interval: number | undefined;
    let fade: number | undefined;

    async function load() {
      const result = await getRandomQuote();
      if (!live || !result.ok) return; // keep showing the last quote if a request fails
      const next = result.data.quote;
      if (next.id === shownId.current) return;
      const first = shownId.current === null;
      shownId.current = next.id;
      if (first) {
        setQuote(next);
        setVisible(true);
        setCycle((c) => c + 1);
        return;
      }
      setVisible(false); // fade out, swap, fade in
      fade = window.setTimeout(() => {
        if (!live) return;
        setQuote(next);
        setVisible(true);
        setCycle((c) => c + 1);
      }, FADE_MS);
    }

    const tick = () => {
      if (!pausedRef.current && !document.hidden) void load();
    };

    // Quotes change on the 15-second marks of the clock, so the first tick waits for the next mark;
    // from then on a plain interval keeps step with it.
    const start = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, QUOTE_INTERVAL_MS);
    }, QUOTE_INTERVAL_MS - (Date.now() % QUOTE_INTERVAL_MS) + 250);
    void load();

    return () => {
      live = false;
      window.clearTimeout(start);
      window.clearTimeout(fade);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <footer
      data-quote-banner
      aria-label="Motivational quote"
      className="fixed inset-x-0 bottom-0 z-30 h-(--quote-banner-h) bg-white/95 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur lg:left-72 dark:bg-neutral-950/95"
    >
      {/* The top edge doubles as the progress line: it fills in red until the next quote. */}
      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-neutral-200/80 dark:bg-neutral-800" aria-hidden="true">
        {quote && !paused && (
          <span
            key={cycle}
            className="block h-full origin-left animate-quote-progress bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 shadow-[0_0_6px_rgba(207,35,41,0.6)] motion-reduce:hidden"
          />
        )}
      </div>

      <div className="mx-auto flex h-full max-w-6xl items-center gap-2.5 px-4 sm:px-6">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-600 text-white" aria-hidden="true">
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
              <blockquote title={quote.text} className="min-w-0 truncate text-xs font-medium text-neutral-700 sm:text-[13px] dark:text-neutral-200">
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
          className="grid size-7 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-brand-50 hover:text-brand-600 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
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
