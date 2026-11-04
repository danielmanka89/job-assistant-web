"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { speak } from "@/lib/client/speech";

const WELCOME = "Welcome to JobAssistant. Connecting candidates and employers across all timezones. Let's get to work.";

// US time zones, west to east. Abbreviations come from the browser, so they switch to PDT/CDT/EDT
// during daylight saving time.
const ZONES = [
  { label: "Pacific", timeZone: "America/Los_Angeles" },
  { label: "Central", timeZone: "America/Chicago" },
  { label: "Eastern", timeZone: "America/New_York" },
] as const;

const formats = ZONES.map((zone) => ({
  time: new Intl.DateTimeFormat("en-US", { timeZone: zone.timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }),
  day: new Intl.DateTimeFormat("en-US", { timeZone: zone.timeZone, weekday: "short", month: "short", day: "numeric" }),
  abbr: new Intl.DateTimeFormat("en-US", { timeZone: zone.timeZone, timeZoneName: "short" }),
}));

function zoneAbbr(i: number, date: Date): string {
  return formats[i].abbr.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
}

// The clock ticks once a second. The server renders placeholders, so the markup matches on hydration.
function subscribeToClock(onTick: () => void): () => void {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
}
const nowInSeconds = () => Math.floor(Date.now() / 1000);
const noTimeOnServer = () => null;

function WorldClock() {
  const seconds = useSyncExternalStore(subscribeToClock, nowInSeconds, noTimeOnServer);
  const date = seconds === null ? null : new Date(seconds * 1000);
  return (
    <ul className="grid grid-cols-3 gap-2 sm:gap-3">
      {ZONES.map((zone, i) => (
        <li key={zone.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center">
          <p className="text-[11px] font-semibold tracking-widest text-white/60 uppercase">{zone.label}</p>
          <time
            dateTime={date?.toISOString()}
            className="mt-1 block font-display text-xl font-medium text-white tabular-nums sm:text-2xl"
          >
            {date ? formats[i].time.format(date) : "--:--:--"}
          </time>
          <p className="mt-1 text-[11px] leading-snug text-white/55 tabular-nums">
            <span className="block font-semibold text-white/70">{date ? zoneAbbr(i, date) : " "}</span>
            <span className="block whitespace-nowrap">{date ? formats[i].day.format(date) : " "}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

// Respect "reduce motion": the looping video stays on its still first frame (or the poster image).
function pauseIfReducedMotion(video: HTMLVideoElement | null) {
  if (video && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    video.autoplay = false;
    video.pause();
  }
}

/**
 * Full-screen landing hero: an anime study scene at sunset (looping /anime-bg.mp4 once it's added,
 * with /anime-bg.jpg as the poster until then), a frosted-glass panel with the site name, a live
 * Pacific / Central / Eastern clock, and a spoken welcome.
 */
export function ImmersiveHero() {
  const [entered, setEntered] = useState(false);

  function enter() {
    speak(WELCOME);
    setEntered(true);
  }

  return (
    <section aria-label="Welcome" className="relative isolate flex min-h-[40rem] items-end overflow-hidden bg-neutral-950 h-dvh">
      <video
        ref={pauseIfReducedMotion}
        className="absolute inset-0 -z-20 size-full object-cover"
        poster="/anime-bg.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src="/anime-bg.mp4" type="video/mp4" />
      </video>
      {/* Darkens the edges so the panel and text stay readable over any frame. */}
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(10,6,12,0.85),rgba(10,6,12,0.15)_45%,rgba(10,6,12,0.35)),radial-gradient(60rem_40rem_at_85%_90%,rgba(10,6,12,0.5),transparent)]"
        aria-hidden="true"
      />

      <div className="mx-auto flex w-full max-w-6xl justify-center px-4 pb-10 sm:px-6 sm:pb-14 lg:justify-end">
        <div className="w-full max-w-md animate-glass-in rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150 motion-reduce:animate-none sm:p-8">
          <div className="relative text-center">
            <span
              className="absolute inset-x-6 top-1/2 -z-10 h-14 -translate-y-1/2 animate-glow-pulse rounded-full bg-[radial-gradient(closest-side,rgba(251,146,60,0.75),rgba(244,63,94,0.35),transparent)] blur-2xl motion-reduce:animate-none"
              aria-hidden="true"
            />
            <p className="font-display text-3xl font-semibold tracking-[0.18em] text-white uppercase drop-shadow-[0_0_18px_rgba(251,146,60,0.55)] sm:text-4xl">
              JobAssistant <span className="text-orange-300">Global</span>
            </p>
            <p className="mt-2 text-sm text-white/70">Candidates and employers, across every timezone.</p>
          </div>

          <div className="mt-6">
            <WorldClock />
          </div>

          <button
            type="button"
            onClick={enter}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3.5 font-display text-base font-medium tracking-wider text-white uppercase shadow-lg shadow-orange-500/30 transition hover:brightness-110 focus-visible:ring-4 focus-visible:ring-orange-300/50 focus-visible:outline-none"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
            </svg>
            {entered ? "Play welcome again" : "Enter Experience"}
          </button>

          {entered && (
            <div className="mt-5 animate-glass-in motion-reduce:animate-none">
              {/* What the voice says, for anyone who can't hear it. */}
              <p className="text-center text-sm leading-relaxed text-white/80 italic">&ldquo;{WELCOME}&rdquo;</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link
                  href="/register"
                  className="rounded-full bg-white px-4 py-2.5 text-center font-display text-sm font-medium tracking-wider text-neutral-900 uppercase transition hover:bg-white/90"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-white/30 px-4 py-2.5 text-center font-display text-sm font-medium tracking-wider text-white uppercase transition hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <a
        href="#home"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs font-semibold tracking-widest text-white/70 uppercase transition hover:text-white lg:left-10 lg:flex lg:translate-x-0"
      >
        Scroll to explore
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 animate-bounce motion-reduce:animate-none" aria-hidden="true">
          <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3.75A.75.75 0 0 1 10 3Z" clipRule="evenodd" />
        </svg>
      </a>
    </section>
  );
}
