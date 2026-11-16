"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHAT_CHANGED_EVENT, answerFollowRequest, getChatSummary } from "@/lib/client/api";
import { Avatar } from "@/components/ui/avatar";
import type { ChatSummary } from "@/lib/types";

const POLL_MS = 30000;
const DISMISSED_KEY = "follow-requests-dismissed";

function readDismissed(): string {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * The follow-request notification: when someone asks to follow you, a card pops up at the top right
 * with Accept and Decline. Closing it hides it until a new request arrives. Chat's People tab lists
 * every request, so the card isn't shown there.
 */
export function FollowRequestNotice() {
  const pathname = usePathname() ?? "";
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () =>
      void getChatSummary().then((result) => {
        if (live && result.ok) setSummary(result.data);
      });
    load();
    const timer = setInterval(load, POLL_MS);
    window.addEventListener(CHAT_CHANGED_EVENT, load);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener(CHAT_CHANGED_EVENT, load);
    };
  }, []);

  const requesters = summary?.requesters ?? [];
  const key = requesters.map((r) => r.id).join(",");
  if (!requesters.length || key === dismissed || pathname.startsWith("/dashboard/chat")) return null;

  const first = requesters[0];
  const others = (summary?.requests ?? 1) - 1;

  function dismiss() {
    setDismissed(key);
    try {
      sessionStorage.setItem(DISMISSED_KEY, key);
    } catch {
      // Private mode: it just shows again on the next page load.
    }
  }

  async function answer(accept: boolean) {
    setBusy(true);
    const result = await answerFollowRequest(first.id, accept);
    setBusy(false);
    if (result.ok) setSummary((s) => s && { ...s, requests: s.requests - 1, requesters: s.requesters.slice(1) });
  }

  return (
    <div
      role="region"
      aria-label="Follow request"
      className="fixed top-[4.75rem] right-3 left-3 z-50 motion-safe:animate-panel-in sm:left-auto sm:w-80 lg:top-[calc(var(--edge)+0.75rem)] lg:right-[calc(var(--edge)+0.75rem)]"
    >
      <div className="rounded-2xl border border-neutral-200/80 bg-white/95 p-3 shadow-xl shadow-neutral-900/10 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
        <div className="flex items-start gap-2.5">
          <Avatar name={first.name} className="size-9 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-neutral-900 dark:text-white">
              <span className="font-semibold">{first.name}</span> wants to follow you
            </p>
            {others > 0 && (
              <Link href="/dashboard/chat?tab=people" className="rounded text-xs font-medium text-brand-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-300">
                +{others} more request{others === 1 ? "" : "s"}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close for now"
            className="grid size-7 shrink-0 place-items-center rounded-lg text-neutral-400 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer(true)}
            className="flex-1 rounded-xl bg-brand-600 py-1.5 text-xs font-semibold text-white transition outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 hover:bg-brand-500 disabled:opacity-60"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer(false)}
            className="flex-1 rounded-xl border border-neutral-300 py-1.5 text-xs font-semibold text-neutral-700 transition outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
