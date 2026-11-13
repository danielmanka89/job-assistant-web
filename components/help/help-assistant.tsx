"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { askHelp, type HelpTurn } from "@/lib/client/api";
import { speak } from "@/lib/client/speech";
import { useVoiceInput } from "@/lib/client/voice-input";

// The help assistant: a button in the bottom-right corner of every dashboard page that opens a chat
// about how to use the app. Type a question or tap the mic and say it; spoken questions get spoken
// answers. Answers come from the guides in lib/help-content.ts (see app/api/help/chat).

/** Opens the assistant from anywhere, optionally asking a question straight away. */
export const OPEN_HELP_EVENT = "help-assistant:open";
export function openHelpAssistant(question?: string) {
  window.dispatchEvent(new CustomEvent<{ question?: string }>(OPEN_HELP_EVENT, { detail: { question } }));
}

const SUGGESTIONS = [
  "How do I tailor my resume to a job?",
  "What does the deadline tracker show?",
  "How do I download my applications as Excel?",
  "How do I change to dark mode?",
];

const SPEAK_KEY = "help-assistant-speak";

export function HelpAssistant() {
  const pathname = usePathname() ?? "/dashboard";
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<HelpTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  const send = useCallback(
    async (question: string, spoken = false) => {
      const text = question.trim();
      if (!text || busy) return;
      const history: HelpTurn[] = [...turns, { role: "user", content: text }];
      setTurns([...history, { role: "assistant", content: "" }]);
      setDraft("");
      setError(null);
      setBusy(true);
      const controller = new AbortController();
      abort.current = controller;
      const result = await askHelp(
        history,
        pathname,
        (piece) =>
          setTurns((list) => {
            const next = [...list];
            const last = next[next.length - 1];
            if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + piece };
            return next;
          }),
        controller.signal,
      );
      abort.current = null;
      setBusy(false);
      if (!result.ok) {
        setTurns(history.slice(0, -1)); // take the question back out so it can be asked again
        setDraft(text);
        setError(result.error.message);
        return;
      }
      if ((spoken || speakReplies) && result.data.trim()) speak(result.data);
    },
    [busy, turns, pathname, speakReplies],
  );

  const voice = useVoiceInput((text) => void send(text, true));

  // Remember whether replies are read aloud.
  useEffect(() => {
    try {
      const id = window.setTimeout(() => setSpeakReplies(window.localStorage.getItem(SPEAK_KEY) === "1"), 0);
      return () => window.clearTimeout(id);
    } catch {
      return undefined;
    }
  }, []);
  function toggleSpeak() {
    const next = !speakReplies;
    setSpeakReplies(next);
    if (!next) window.speechSynthesis?.cancel();
    try {
      window.localStorage.setItem(SPEAK_KEY, next ? "1" : "0");
    } catch {
      // storage blocked: the choice lasts for this page only
    }
  }

  // Opened from elsewhere (Settings › Help Center), maybe with a question.
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const question = (e as CustomEvent<{ question?: string }>).detail?.question;
      if (question) void send(question);
    };
    window.addEventListener(OPEN_HELP_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HELP_EVENT, onOpen);
  }, [send]);

  // Focus the question box on open; Escape closes and returns focus to the button.
  const stopListening = voice.stop;
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      stopListening();
      window.speechSynthesis?.cancel();
      buttonRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stopListening]);

  // Keep the newest message in view as the answer streams in.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [turns, open]);

  function close() {
    setOpen(false);
    voice.stop();
    window.speechSynthesis?.cancel();
  }

  function startOver() {
    abort.current?.abort();
    window.speechSynthesis?.cancel();
    setTurns([]);
    setError(null);
    setBusy(false);
    inputRef.current?.focus();
  }

  const shownDraft = voice.listening ? voice.transcript : draft;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? "Close help assistant" : "Help: ask how to use JobAssistant"}
        title="Help"
        className="fixed right-4 bottom-[calc(var(--quote-banner-space)+0.5rem)] z-40 grid size-12 place-items-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-500/40 focus-visible:outline-none"
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6" aria-hidden="true">
            <path d="M12 21a9 9 0 1 0-8.1-5.1L3 21l5.1-.9A9 9 0 0 0 12 21Z" strokeLinejoin="round" />
            <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.4v.5" strokeLinecap="round" />
            <circle cx="12" cy="16.6" r=".6" fill="currentColor" />
          </svg>
        )}
      </button>

      {open && (
        <section
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          className="fixed right-4 bottom-[calc(var(--quote-banner-space)+4rem)] z-[55] flex h-[min(34rem,calc(100dvh-9rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-2xl shadow-neutral-900/20 motion-safe:animate-panel-in dark:border-neutral-800 dark:bg-neutral-950"
        >
          <header className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-sm font-semibold text-neutral-900 dark:text-white">
                Help assistant
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Ask anything about using JobAssistant</p>
            </div>
            <button
              type="button"
              onClick={toggleSpeak}
              aria-pressed={speakReplies}
              aria-label="Read answers aloud"
              title={speakReplies ? "Answers are read aloud" : "Read answers aloud"}
              className={`grid size-8 place-items-center rounded-lg transition focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none ${
                speakReplies ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-[18px]" aria-hidden="true">
                <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" strokeLinejoin="round" />
                {speakReplies ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" strokeLinecap="round" /> : <path d="m16 10 4 4m0-4-4 4" strokeLinecap="round" />}
              </svg>
            </button>
            {turns.length > 0 && (
              <button
                type="button"
                onClick={startOver}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                New chat
              </button>
            )}
          </header>

          <div ref={logRef} role="log" aria-live="polite" aria-busy={busy} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turns.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  Hi! I can explain any part of JobAssistant: tailoring your resume, the Job Board, the Spreadsheet, deadlines, learning, chat, email and
                  settings. Type a question, or tap the mic and ask out loud.
                </p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Suggested questions">
                  {SUGGESTIONS.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => void send(q)}
                        className="rounded-full border border-neutral-200 px-3 py-1.5 text-left text-xs text-neutral-700 transition hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-brand-500/10"
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              turns.map((turn, i) =>
                turn.role === "user" ? (
                  <p key={i} className="ml-8 rounded-2xl rounded-br-md bg-brand-600 px-3 py-2 text-sm whitespace-pre-wrap text-white">
                    <span className="sr-only">You: </span>
                    {turn.content}
                  </p>
                ) : (
                  <p key={i} className="mr-6 rounded-2xl rounded-bl-md bg-neutral-100 px-3 py-2 text-sm whitespace-pre-wrap text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                    <span className="sr-only">Assistant: </span>
                    {turn.content || (
                      <span className="inline-flex gap-1 py-1">
                        <span className="sr-only">Thinking…</span>
                        <span className="size-1.5 rounded-full bg-neutral-400 motion-safe:animate-bounce [animation-delay:-0.2s]" aria-hidden="true" />
                        <span className="size-1.5 rounded-full bg-neutral-400 motion-safe:animate-bounce [animation-delay:-0.1s]" aria-hidden="true" />
                        <span className="size-1.5 rounded-full bg-neutral-400 motion-safe:animate-bounce" aria-hidden="true" />
                      </span>
                    )}
                  </p>
                ),
              )
            )}
          </div>

          {(error || voice.error) && (
            <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error ?? voice.error}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
            className="flex items-end gap-2 border-t border-neutral-100 p-3 dark:border-neutral-800"
          >
            <label htmlFor={`${panelId}-q`} className="sr-only">
              Your question
            </label>
            <textarea
              id={`${panelId}-q`}
              ref={inputRef}
              value={shownDraft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              readOnly={voice.listening}
              rows={1}
              maxLength={2000}
              placeholder={voice.listening ? "Listening…" : "Ask a question…"}
              className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
            {voice.supported && (
              <button
                type="button"
                onClick={() => (voice.listening ? voice.stop() : voice.start())}
                disabled={busy}
                aria-pressed={voice.listening}
                aria-label={voice.listening ? "Stop listening" : "Ask by voice"}
                title={voice.listening ? "Stop listening" : "Ask by voice"}
                className={`grid size-10 shrink-0 place-items-center rounded-xl transition focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:opacity-50 ${
                  voice.listening
                    ? "bg-red-600 text-white motion-safe:animate-pulse"
                    : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                  <rect x="9" y="3.5" width="6" height="11" rx="3" />
                  <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={busy || voice.listening || !draft.trim()}
              aria-label="Send question"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-[18px]" aria-hidden="true">
                <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}
