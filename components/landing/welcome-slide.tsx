"use client";

import { useState } from "react";
import Link from "next/link";
import { speak } from "@/lib/client/speech";
import { useNow, zoneTimes } from "@/lib/client/us-clock";

const WELCOME = "Welcome to JobAssistant. Connecting candidates across all timezones.";

function WorldClock() {
  const now = useNow();
  return (
    <ul className="grid grid-cols-3 gap-2 sm:gap-3">
      {zoneTimes(now).map((zone) => (
        <li key={zone.label} className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2.5 text-center sm:px-3">
          <p className="text-[11px] font-semibold tracking-widest text-white/60 uppercase">{zone.label}</p>
          <time dateTime={now?.toISOString()} className="mt-0.5 block font-display text-lg font-medium text-white tabular-nums sm:text-xl">
            {zone.time}
          </time>
          <p className="text-[11px] font-semibold text-white/60">{zone.abbr || " "}</p>
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
 * Slide 1 of the landing page: an anime study scene at sunset (looping /anime-bg.mp4 once it's added,
 * with /anime-bg.jpg as the poster until then), the site name in the middle, and a frosted-glass panel
 * with live US clocks and a spoken welcome.
 */
export function WelcomeSlide() {
  const [entered, setEntered] = useState(false);

  function enter() {
    speak(WELCOME);
    setEntered(true);
  }

  return (
    <div className="mono-grayscale relative isolate flex size-full flex-col items-center justify-center gap-8 overflow-hidden bg-neutral-950 px-4 py-16 sm:gap-10">
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
      {/* Darkens the scene so the name and panel stay readable over any frame. */}
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_30rem_at_50%_45%,rgba(10,6,12,0.55),transparent),linear-gradient(to_top,rgba(10,6,12,0.8),rgba(10,6,12,0.2)_50%,rgba(10,6,12,0.45))]"
        aria-hidden="true"
      />

      <div className="relative text-center">
        <span
          className="absolute inset-x-0 top-1/2 -z-10 mx-auto h-24 max-w-xl -translate-y-1/2 animate-glow-pulse rounded-full bg-[radial-gradient(closest-side,rgba(251,146,60,0.7),rgba(244,63,94,0.35),transparent)] blur-2xl motion-reduce:animate-none"
          aria-hidden="true"
        />
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-[0.2em] text-white uppercase drop-shadow-[0_0_22px_rgba(251,146,60,0.6)] sm:text-6xl">
          JobAssistant <span className="text-orange-300">Global</span>
        </h1>
        <p className="mt-3 text-sm text-white/75 sm:text-base">Candidates and employers, across every timezone.</p>
      </div>

      <div className="w-full max-w-md animate-glass-in rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150 motion-reduce:animate-none sm:p-7">
        <WorldClock />

        <button
          type="button"
          onClick={enter}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-6 py-3.5 font-display text-base font-medium tracking-wider text-white uppercase shadow-lg shadow-orange-500/30 transition hover:brightness-110 focus-visible:ring-4 focus-visible:ring-orange-300/50 focus-visible:outline-none"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
          </svg>
          {entered ? "Play welcome again" : "Enter Experience"}
        </button>

        {entered && (
          /* What the voice says, for anyone who can't hear it. */
          <p className="mt-4 animate-glass-in text-center text-sm leading-relaxed text-white/80 italic motion-reduce:animate-none">
            &ldquo;{WELCOME}&rdquo;
          </p>
        )}

        {/* Always shown, so signing up or in never depends on playing the voice or finding the slides. */}
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
    </div>
  );
}
