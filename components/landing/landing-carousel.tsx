"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export interface Slide {
  label: string; // "Welcome", "How it works"…, read out as "Slide 1 of 3: Welcome"
  content: ReactNode;
}

const SWIPE_PX = 50;
const WHEEL_COOLDOWN_MS = 900;

/**
 * Full-screen horizontal slider: the page never scrolls; arrows (tablet and up), dots, the keyboard's
 * arrow keys, a swipe or a mouse wheel move between slides. Slides that are off screen are inert, so Tab only
 * reaches the slide in view.
 */
export function LandingCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const last = slides.length - 1;
  const go = useCallback((to: number) => setIndex(Math.max(0, Math.min(last, to))), [last]);

  // Arrow keys move slides unless the user is typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(last, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  // A wheel or trackpad gesture moves one slide, then waits so one flick doesn't skip slides.
  const wheelLock = useRef(0);
  function onWheel(e: React.WheelEvent) {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 25 || e.timeStamp < wheelLock.current) return;
    wheelLock.current = e.timeStamp + WHEEL_COOLDOWN_MS;
    go(index + (delta > 0 ? 1 : -1));
  }

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") swipeStart.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: React.PointerEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - start.y)) go(index + (dx < 0 ? 1 : -1));
  }

  const arrow =
    "absolute top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/30 text-white shadow-lg backdrop-blur-md transition hover:bg-black/45 focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-0 sm:grid sm:size-12";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="JobAssistant"
      className="relative size-full touch-pan-y overflow-hidden"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipeStart.current = null)}
    >
      <div
        className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.label}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${slide.label}`}
            inert={i !== index}
            className="h-full w-full shrink-0"
          >
            {slide.content}
          </div>
        ))}
      </div>

      <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous slide" className={`${arrow} left-3 sm:left-6`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
          <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
        </svg>
      </button>
      <button type="button" onClick={() => go(index + 1)} disabled={index === last} aria-label="Next slide" className={`${arrow} right-3 sm:right-6`}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
          <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Tells screen readers which slide is showing after the arrows, dots or keys move it. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`Slide ${index + 1} of ${slides.length}: ${slides[index]?.label ?? ""}`}
      </p>

      <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center sm:bottom-6">
        <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/30 px-2 py-1.5 backdrop-blur-md">
          {slides.map((slide, i) => (
            <button
              key={slide.label}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}: ${slide.label}`}
              aria-current={i === index ? "true" : undefined}
              className="grid h-6 place-items-center px-1 focus-visible:outline-none [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-white"
            >
              <span className={`block h-2 rounded-full transition-all duration-300 ${i === index ? "w-7 bg-white" : "w-2 bg-white/45 hover:bg-white/70"}`} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
