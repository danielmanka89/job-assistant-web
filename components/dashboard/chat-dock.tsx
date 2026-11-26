"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHAT_CHANGED_EVENT, getChat, listChats, listConnections, openChat, sendChatMessage } from "@/lib/client/api";
import { RingAvatar } from "@/components/ui/ring-avatar";
import { MAX_MESSAGE_CHARS, type ChatConversation, type ChatMessage, type Person } from "@/lib/types";

// The chat column: always on the right of every dashboard page on laptops (the page keeps the other
// 75%). Your chats on top, the open conversation and a message box below, People to start a new one.
// Hidden on the Chat page itself, which has the full view, and on phones.

const LIST_POLL_MS = 15000;
const THREAD_POLL_MS = 4000;

const visible = () => document.visibilityState === "visible";
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function ChatDock() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/dashboard/chat")) return null;
  return <Dock />;
}

function Dock() {
  const [tab, setTab] = useState<"chats" | "people">("chats");
  const [chats, setChats] = useState<ChatConversation[] | null | "error">(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    if (!visible()) return;
    const result = await listChats();
    setChats(result.ok ? [...result.data].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)) : "error");
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void loadChats(), 0);
    const timer = window.setInterval(() => void loadChats(), LIST_POLL_MS);
    const reload = () => void loadChats();
    window.addEventListener(CHAT_CHANGED_EVENT, reload);
    document.addEventListener("visibilitychange", reload);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener(CHAT_CHANGED_EVENT, reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [loadChats]);

  // With nothing picked yet, the most recent chat is open.
  const list = Array.isArray(chats) ? chats : [];
  const current = openId ?? list[0]?.id ?? null;

  async function startWith(person: Person) {
    const result = await openChat(person.id);
    if (!result.ok) return;
    setOpenId(result.data.id);
    setTab("chats");
    void loadChats();
  }

  return (
    <aside
      data-chat-dock
      aria-label="Chat"
      className="fixed top-(--topbar-h) right-3 bottom-[calc(var(--quote-banner-h)+0.75rem)] z-30 hidden w-[calc(var(--chat-w)-1.5rem)] flex-col overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm lg:flex dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200/70 px-3 py-2.5 dark:border-white/10">
        <div role="tablist" aria-label="Chat" className="flex gap-1 rounded-full bg-neutral-100 p-1 text-xs font-semibold dark:bg-white/5">
          {(["chats", "people"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 capitalize outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${tab === t ? "pill-seg-on" : "pill-seg-off"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <Link href={current ? `/dashboard/chat?c=${encodeURIComponent(current)}` : "/dashboard/chat"} className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Full chat ↗
        </Link>
      </div>

      {tab === "people" ? (
        <PeopleList onPick={startWith} />
      ) : chats === null ? (
        <div className="space-y-2 p-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-12 animate-pulse rounded-2xl bg-neutral-100 dark:bg-white/5" />
          ))}
        </div>
      ) : chats === "error" ? (
        <p className="p-4 text-sm text-neutral-500 dark:text-neutral-400">Chats couldn&apos;t be loaded right now.</p>
      ) : list.length === 0 ? (
        <p className="p-4 text-sm text-neutral-500 dark:text-neutral-400">
          No chats yet. Pick someone under{" "}
          <button type="button" onClick={() => setTab("people")} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            People
          </button>{" "}
          to start one.
        </p>
      ) : (
        <>
          <ul className="max-h-[38%] shrink-0 space-y-0.5 overflow-y-auto p-2">
            {list.map((chat) => (
              <li key={chat.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(chat.id)}
                  aria-current={chat.id === current ? "true" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-2xl p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                    chat.id === current ? "bg-neutral-100 dark:bg-white/10" : "hover:bg-neutral-50 dark:hover:bg-white/5"
                  }`}
                >
                  <RingAvatar name={chat.person.name} photoUrl={chat.person.photoUrl} ring={chat.person.ring} online={chat.person.online} className="size-9" />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] text-neutral-900 dark:text-white ${chat.unread ? "font-bold" : "font-semibold"}`}>{chat.person.name}</span>
                    <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{chat.lastMessage ?? "No messages yet"}</span>
                  </span>
                  {chat.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-semibold text-white tabular-nums">
                      {chat.unread > 99 ? "99+" : chat.unread}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {current && <Thread key={current} id={current} onSent={() => void loadChats()} />}
        </>
      )}
    </aside>
  );
}

/** People you follow or who follow you; picking one opens (or starts) your chat with them. */
function PeopleList({ onPick }: { onPick: (person: Person) => void }) {
  const [people, setPeople] = useState<Person[] | null | "error">(null);

  useEffect(() => {
    let live = true;
    listConnections().then((result) => {
      if (!live) return;
      if (!result.ok) return setPeople("error");
      const seen = new Map<string, Person>();
      for (const p of [...result.data.connectedTo, ...result.data.connectedToMe]) if (!seen.has(p.id)) seen.set(p.id, p);
      setPeople([...seen.values()].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)));
    });
    return () => {
      live = false;
    };
  }, []);

  if (people === null) return <span className="m-3 block h-24 animate-pulse rounded-2xl bg-neutral-100 dark:bg-white/5" aria-busy="true" />;
  if (people === "error") return <p className="p-4 text-sm text-neutral-500 dark:text-neutral-400">People couldn&apos;t be loaded right now.</p>;
  if (people.length === 0)
    return (
      <p className="p-4 text-sm text-neutral-500 dark:text-neutral-400">
        You&apos;re not connected with anyone yet.{" "}
        <Link href="/dashboard/chat?tab=people" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
          Find people
        </Link>
      </p>
    );
  return (
    <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
      {people.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onPick(p)}
            className="flex w-full items-center gap-2.5 rounded-2xl p-2 text-left outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-white/5"
          >
            <RingAvatar name={p.name} photoUrl={p.photoUrl} ring={p.ring} online={p.online} className="size-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-neutral-900 dark:text-white">{p.name}</span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">{p.online ? "In the app now" : "Away"}</span>
            </span>
            <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">Message</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One conversation: its messages (newest at the bottom, checked every few seconds) and a message box. */
function Thread({ id, onSent }: { id: string; onSent: () => void }) {
  const [person, setPerson] = useState<Person | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [canSend, setCanSend] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const latest = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!visible()) return;
    const result = await getChat(id, latest.current);
    if (!result.ok) return;
    setPerson(result.data.person);
    setCanSend(result.data.canSend);
    if (result.data.messages.length) {
      latest.current = result.data.messages[result.data.messages.length - 1].createdAt;
      setMessages((old) => {
        const known = new Set((old ?? []).map((m) => m.id));
        return [...(old ?? []), ...result.data.messages.filter((m) => !known.has(m.id))];
      });
    } else {
      setMessages((old) => old ?? []);
    }
  }, [id]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), THREAD_POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const result = await sendChatMessage(id, body);
    setSending(false);
    if (!result.ok) {
      setError(result.error.message || "Couldn't send. Please try again.");
      return;
    }
    setDraft("");
    setMessages((old) => (old?.some((m) => m.id === result.data.id) ? old : [...(old ?? []), result.data]));
    latest.current = result.data.createdAt;
    onSent();
  }

  return (
    <section aria-label={person ? `Conversation with ${person.name}` : "Conversation"} className="flex min-h-0 flex-1 flex-col border-t border-neutral-200/70 dark:border-white/10">
      <p className="truncate px-4 pt-2.5 text-center text-[11px] text-neutral-500 dark:text-neutral-400">{person?.name ?? " "}</p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2" aria-live="polite">
        {messages === null ? (
          <span className="block h-16 animate-pulse rounded-2xl bg-neutral-100 dark:bg-white/5" aria-busy="true" />
        ) : messages.length === 0 ? (
          <p className="pt-6 text-center text-xs text-neutral-500 dark:text-neutral-400">Say hello to start the conversation.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId !== person?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <p
                  title={timeFormat.format(new Date(m.createdAt))}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug break-words whitespace-pre-wrap ${
                    mine ? "rounded-br-md bg-neutral-800 text-white dark:bg-brand-500" : "rounded-bl-md bg-neutral-100 text-neutral-900 dark:bg-white/10 dark:text-neutral-100"
                  }`}
                >
                  {m.body}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>
      {canSend ? (
        <form onSubmit={send} className="p-2.5">
          {error && <p className="px-2 pb-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 pr-1 pl-3.5 dark:border-white/10 dark:bg-white/5">
            <label htmlFor={`dock-msg-${id}`} className="sr-only">
              Message {person?.name}
            </label>
            <input
              id={`dock-msg-${id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_MESSAGE_CHARS}
              placeholder={person ? `Message ${person.name.split(" ")[0]}…` : "Message…"}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Send"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-800 text-white transition outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-40 dark:bg-brand-500"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
                <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </form>
      ) : (
        <p className="p-3 text-center text-xs text-neutral-500 dark:text-neutral-400">You&apos;re no longer connected, so you can&apos;t send messages here.</p>
      )}
    </section>
  );
}
