"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiError, IntroductionResponse } from "@/lib/types";
import { getIntroduction, logout, writeIntroduction } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

type Intro = NonNullable<IntroductionResponse["introduction"]>;
type Load = { status: "loading" } | { status: "writing" } | { status: "error"; message: string } | { status: "ready"; intro: Intro };
type Follow = "off" | "voice" | "auto";

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";
const norm = (word: string) => word.toLowerCase().replace(/[^a-z0-9]/g, "");
const READING_WPM = 140; // a calm interview pace

// The browser's speech recognition (Chrome, Edge, Safari). Typed loosely: it isn't in TS's DOM lib.
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
function createRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * Where the reader is in the script, from what they just said: the last few spoken words are lined
 * up against the next stretch of the script, and the best match moves the position forward. A lone
 * word only nudges it (within 3 words); nearby matches need 2 words in a row; jumping further ahead
 * (a skipped sentence) needs 4, so a common word said in passing can't throw the script forward.
 */
export function followSpeech(words: string[], pos: number, spoken: string[]): number {
  const tail = spoken.slice(-6);
  if (!tail.length) return pos;
  let best = { score: 0, end: -1 };
  const from = Math.max(0, pos - 3);
  const to = Math.min(words.length - 1, pos + 90);
  for (let j = from; j <= to; j++) {
    let score = 0;
    for (let k = 0; k < tail.length && j - k >= 0; k++) if (words[j - k] === tail[tail.length - 1 - k]) score += 1;
    const ahead = j - pos;
    const needed = ahead > 20 ? 4 : tail.length >= 3 ? 2 : ahead <= 3 ? tail.length : Infinity;
    // Prefer the strongest match; among equals, the nearest one.
    if (score >= needed && score > best.score) best = { score, end: j };
  }
  return best.end + 1 > pos ? best.end + 1 : pos;
}

/** "My Introduction": an AI-written interview introduction in a distraction-free, voice-following reader. */
export function MyIntroductionButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="px-7 py-3 text-base">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" strokeLinecap="round" />
        </svg>
        My Introduction
      </Button>
      {open && <IntroductionReader onClose={() => setOpen(false)} />}
    </>
  );
}

function IntroductionReader({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [pos, setPos] = useState(0); // index of the next word to say
  const [follow, setFollow] = useState<Follow>("off");
  const [wpm, setWpm] = useState(READING_WPM);
  const [size, setSize] = useState(1); // text size step
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const followRef = useRef<Follow>("off");
  const posRef = useRef(0);
  const [voiceSupported] = useState(() => Boolean(createRecognition()));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const write = useCallback(async () => {
    setLoad({ status: "writing" });
    const result = await writeIntroduction();
    if (!result.ok) {
      if (isUnauthorized(result.error)) {
        await logout();
        router.replace("/login");
        return;
      }
      setLoad({ status: "error", message: result.error.message });
      return;
    }
    if (result.data.introduction) {
      setPos(0);
      setLoad({ status: "ready", intro: result.data.introduction });
    }
  }, [router]);

  // Open the saved introduction; write one the first time.
  useEffect(() => {
    let live = true;
    getIntroduction().then((result) => {
      if (!live) return;
      if (!result.ok) {
        setLoad({ status: "error", message: result.error.message });
        return;
      }
      if (!result.data.hasResume) setLoad({ status: "error", message: "Upload your resume first: your introduction is written from it." });
      else if (result.data.introduction) setLoad({ status: "ready", intro: result.data.introduction });
      else void write();
    });
    return () => {
      live = false;
    };
  }, [write]);

  const intro = load.status === "ready" ? load.intro : null;
  // Every word of the script, with its paragraph, so it can be highlighted and followed.
  const script = useMemo(() => {
    const out: { text: string; key: string; para: number }[] = [];
    intro?.paragraphs.forEach((p, para) => p.split(/\s+/).filter(Boolean).forEach((text) => out.push({ text, key: norm(text), para })));
    return out;
  }, [intro]);
  const keys = useMemo(() => script.map((w) => w.key), [script]);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    followRef.current = follow;
  }, [follow]);

  // Keep the current word about a third of the way down the screen.
  useEffect(() => {
    const box = scrollRef.current;
    const word = box?.querySelector<HTMLElement>(`[data-w="${Math.min(pos, script.length - 1)}"]`);
    if (!box || !word) return;
    const target = word.offsetTop - box.clientHeight * 0.35;
    box.scrollTo({ top: Math.max(0, target), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [pos, script.length, size]);

  // Auto-scroll: move on at the chosen pace.
  useEffect(() => {
    if (follow !== "auto" || !script.length) return;
    const id = window.setInterval(() => setPos((p) => Math.min(script.length, p + 1)), 60_000 / wpm);
    return () => window.clearInterval(id);
  }, [follow, wpm, script.length]);

  const stopVoice = useCallback(() => {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    if (r) {
      r.onend = null;
      r.stop();
    }
  }, []);

  const startVoice = useCallback(() => {
    const r = createRecognition();
    if (!r) {
      setVoiceNote("Your browser can't follow your voice. Use Auto-scroll instead (Chrome, Edge and Safari support voice).");
      setFollow("auto");
      return;
    }
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let heard = "";
      for (let i = Math.max(0, e.results.length - 3); i < e.results.length; i++) heard += ` ${e.results[i][0].transcript}`;
      const spoken = heard.split(/\s+/).map(norm).filter(Boolean);
      const next = followSpeech(keys, posRef.current, spoken);
      if (next !== posRef.current) setPos(next);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setVoiceNote("Microphone access is off, so we can't follow your voice. Allow it in your browser, or use Auto-scroll.");
        setFollow("off");
        stopVoice();
      }
    };
    // Browsers stop listening after a pause; keep going while voice following is on.
    r.onend = () => {
      if (followRef.current === "voice" && recognitionRef.current === r) {
        try {
          r.start();
        } catch {
          /* already restarting */
        }
      }
    };
    recognitionRef.current = r;
    setVoiceNote(null);
    setFollow("voice");
    r.start();
  }, [keys, stopVoice]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  function choose(next: Follow) {
    if (follow === "voice") stopVoice();
    if (next === "voice" && follow !== "voice") startVoice();
    else setFollow(next === follow ? "off" : next);
  }

  function close() {
    stopVoice();
    onClose();
  }

  const minutes = intro ? Math.max(1, Math.round(intro.wordCount / READING_WPM)) : 0;
  const done = script.length > 0 && pos >= script.length;
  const sizes = ["text-xl sm:text-2xl", "text-2xl sm:text-[1.75rem]", "text-[1.75rem] sm:text-[2.1rem]", "text-[2rem] sm:text-[2.5rem]"];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="intro-title"
      onCancel={(e) => {
        e.preventDefault(); // Escape closes through close() so the microphone stops
        close();
      }}
      onKeyDown={(e) => {
        if (e.key === " " && intro && (e.target as HTMLElement).tagName !== "BUTTON") {
          e.preventDefault();
          choose(follow === "off" ? (voiceSupported ? "voice" : "auto") : follow);
        }
      }}
      // Full screen over a blurred page, so the script is all there is to look at.
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-white/75 p-0 text-neutral-900 backdrop-blur-2xl backdrop:bg-neutral-950/30 backdrop:backdrop-blur-xl dark:bg-neutral-950/80 dark:text-white"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-black/5 px-4 py-3 sm:px-8 dark:border-white/10">
          <div className="min-w-0">
            <h2 id="intro-title" className="font-display text-xl font-semibold tracking-wide uppercase sm:text-2xl">
              My Introduction
            </h2>
            {intro && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {intro.wordCount.toLocaleString()} words · about {minutes} min out loud · for practice, written from your resume
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {intro && (
              <>
                <div className="flex items-center rounded-full border border-black/10 bg-white/70 p-1 dark:border-white/10 dark:bg-white/5" role="group" aria-label="Text size">
                  <button type="button" onClick={() => setSize((s) => Math.max(0, s - 1))} className="grid size-8 place-items-center rounded-full text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10" aria-label="Smaller text">
                    A−
                  </button>
                  <button type="button" onClick={() => setSize((s) => Math.min(sizes.length - 1, s + 1))} className="grid size-8 place-items-center rounded-full text-base font-bold hover:bg-black/5 dark:hover:bg-white/10" aria-label="Larger text">
                    A+
                  </button>
                </div>
                <button type="button" onClick={() => void write()} className="rounded-full px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
                  Rewrite
                </button>
              </>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="grid size-10 place-items-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto scroll-smooth px-5 sm:px-8">
          {load.status === "loading" && <Centered>Opening your introduction…</Centered>}
          {load.status === "writing" && (
            <Centered>
              <span className="mx-auto mb-4 block size-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" aria-hidden="true" />
              Writing your introduction from your resume…
              <span className="mt-1 block text-sm text-neutral-500">This takes about a minute. It covers every job, project and certification on your resume.</span>
            </Centered>
          )}
          {load.status === "error" && (
            <Centered>
              <span className="block text-rose-600 dark:text-rose-400">{load.message}</span>
              <Button type="button" onClick={() => void write()} className="mt-5">
                Try again
              </Button>
            </Centered>
          )}
          {intro && (
            <article className={`mx-auto max-w-3xl py-[30vh] font-medium leading-[1.6] ${sizes[size]}`}>
              {!intro.upToDate && (
                <p className="mb-8 rounded-2xl bg-amber-50 px-5 py-3 text-base text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  This was written from an older resume.{" "}
                  <button type="button" onClick={() => void write()} className="font-semibold underline">
                    Rewrite it from your latest resume
                  </button>
                </p>
              )}
              {intro.paragraphs.map((_, para) => (
                <p key={para} className="mb-[1.2em]">
                  {script.map((w, i) =>
                    w.para !== para ? null : (
                      <span
                        key={i}
                        data-w={i}
                        onClick={() => setPos(i)}
                        className={`cursor-pointer rounded-md transition-colors duration-200 ${
                          i < pos ? "text-neutral-400 dark:text-neutral-500" : i === pos ? "bg-brand-100 text-brand-800 dark:bg-brand-500/25 dark:text-brand-200" : ""
                        }`}
                      >
                        {w.text}{" "}
                      </span>
                    ),
                  )}
                </p>
              ))}
              {done && <p className="text-center text-base text-neutral-500">That&apos;s the end. Nicely done. Restart to practise again.</p>}
            </article>
          )}
        </div>

        {intro && (
          <footer className="shrink-0 border-t border-black/5 px-4 py-3 sm:px-8 dark:border-white/10">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:justify-between">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => choose("voice")}
                  aria-pressed={follow === "voice"}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-display text-sm font-medium tracking-wider uppercase transition ${follow === "voice" ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30" : "border border-brand-600/40 text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"}`}
                >
                  <span className={`size-2.5 rounded-full ${follow === "voice" ? "animate-pulse bg-white" : "bg-brand-600"}`} aria-hidden="true" />
                  {follow === "voice" ? "Listening… (pause)" : "Follow my voice"}
                </button>
                <button
                  type="button"
                  onClick={() => choose("auto")}
                  aria-pressed={follow === "auto"}
                  className={`rounded-full px-5 py-2.5 font-display text-sm font-medium tracking-wider uppercase transition ${follow === "auto" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"}`}
                >
                  {follow === "auto" ? "Auto-scroll on (pause)" : "Auto-scroll"}
                </button>
                {follow === "auto" && (
                  <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                    Speed
                    <input type="range" min={90} max={200} step={10} value={wpm} onChange={(e) => setWpm(Number(e.target.value))} aria-valuetext={`${wpm} words a minute`} className="w-28 accent-brand-600" />
                  </label>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
                <span className="tabular-nums">{Math.round((Math.min(pos, script.length) / Math.max(1, script.length)) * 100)}%</span>
                <button type="button" onClick={() => setPos(0)} className="font-semibold text-neutral-700 hover:underline dark:text-neutral-200">
                  Restart
                </button>
              </div>
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-neutral-500 sm:text-left dark:text-neutral-400" aria-live="polite">
              {voiceNote ??
                (voiceSupported
                  ? "Follow my voice listens with your browser's speech recognition and scrolls as you read. JobAssistant doesn't record you. Tap any word to jump there."
                  : "This browser can't follow your voice; Auto-scroll moves at a steady pace. Tap any word to jump there.")}
            </p>
          </footer>
        )}
      </div>
    </dialog>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center px-6 text-center text-lg font-medium text-neutral-700 dark:text-neutral-200"><div>{children}</div></div>;
}
