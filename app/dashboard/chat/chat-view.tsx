"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CHAT_CHANGED_EVENT,
  connectTo,
  disconnectFrom,
  getChat,
  listChats,
  listConnections,
  logout,
  openChat,
  searchPeople,
  sendChatMessage,
} from "@/lib/client/api";
import { focusFirst, focusLost, tabListKeyDown } from "@/lib/client/a11y";
import {
  CONNECTION_KINDS,
  CONNECTION_KIND_LABEL,
  MAX_MESSAGE_CHARS,
  type ApiError,
  type ChatConversation,
  type ChatMessage,
  type ChatThreadResponse,
  type ConnectionKind,
  type ConnectionsResponse,
  type Person,
} from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

const ROLE_LABEL: Record<Person["role"], string> = { SEEKER: "Job Seeker", EMPLOYER: "Employer" };

const THREAD_POLL_MS = 4000; // new messages in the open chat
const LIST_POLL_MS = 15000; // other chats and connections

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** "3:42 PM" for today, otherwise "Nov 9". */
function shortTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toDateString() === new Date().toDateString() ? timeFormat.format(d) : dayFormat.format(d);
}

type Tab = "chats" | "people";
const TABS: readonly Tab[] = ["chats", "people"];

/** Chats on one side, the open conversation on the other. On phones one of the two shows at a time. */
export function ChatView() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("chats");
  const [chats, setChats] = useState<ChatConversation[] | null>(null);
  const [connections, setConnections] = useState<ConnectionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // The chat that was open before Back, so focus can return to it in the list (phones hide the list while a chat is open).
  const backTo = useRef<string | null>(null);

  useEffect(() => {
    const id = backTo.current;
    backTo.current = null;
    if (id && focusLost()) focusFirst(`chat-item-${id}`, "chat-tab-chats");
  }, [openId]);

  function closeChat() {
    backTo.current = openId;
    setOpenId(null);
  }

  const fail = useCallback(
    async (e: ApiError) => {
      if (isUnauthorized(e)) {
        await logout();
        router.replace("/login");
        return;
      }
      setError(e.message);
    },
    [router],
  );

  const refresh = useCallback(async () => {
    const [c, p] = await Promise.all([listChats(), listConnections()]);
    if (!c.ok) return void fail(c.error);
    if (!p.ok) return void fail(p.error);
    setChats(c.data);
    setConnections(p.data);
  }, [fail]);

  useEffect(() => {
    // Deferred a tick so the first load isn't a state update inside the effect itself.
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), LIST_POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  async function message(person: Person) {
    setError(null);
    const result = await openChat(person.id);
    if (!result.ok) return void fail(result.error);
    setOpenId(result.data.id);
    setTab("chats");
    void refresh();
  }

  async function setConnection(person: Person, kind: ConnectionKind | null) {
    setError(null);
    const result = kind ? await connectTo({ userId: person.id, kind }) : await disconnectFrom(person.id);
    if (!result.ok) return void fail(result.error);
    await refresh();
  }

  const panel = "rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60";

  return (
    <div className="space-y-4">
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div className="grid gap-4 lg:h-[calc(100dvh-17rem-2*var(--edge))] lg:min-h-[28rem] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section aria-label="Chats and people" className={`${panel} flex min-h-0 flex-col ${openId ? "hidden lg:flex" : "flex"}`}>
          <ConnectionCounts connections={connections} />
          <div role="tablist" aria-label="Chats or people" className="mx-4 mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-800/70">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={`chat-tab-${t}`}
                aria-selected={tab === t}
                aria-controls="chat-panel"
                tabIndex={tab === t ? 0 : -1}
                onClick={() => setTab(t)}
                onKeyDown={(e) => tabListKeyDown(e, TABS, tab, setTab, (k) => `chat-tab-${k}`)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 ${
                  tab === t ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {t === "chats" ? "Chats" : "People"}
              </button>
            ))}
          </div>
          <div role="tabpanel" id="chat-panel" aria-labelledby={`chat-tab-${tab}`} className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {tab === "chats" ? (
              <ChatList chats={chats} openId={openId} onOpen={setOpenId} onFindPeople={() => setTab("people")} />
            ) : (
              <PeoplePanel connections={connections} onMessage={message} onConnection={setConnection} onError={fail} />
            )}
          </div>
        </section>

        <section aria-label="Conversation" className={`${panel} min-h-[28rem] flex-col lg:min-h-0 ${openId ? "flex" : "hidden lg:flex"}`}>
          {openId ? (
            <Thread key={openId} id={openId} onBack={closeChat} onActivity={refresh} onError={fail} />
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <p className="font-semibold text-neutral-900 dark:text-white">Pick a chat</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-neutral-500 dark:text-neutral-400">
                  Choose a chat on the left, or find someone under People and connect to start one.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** The account's two numbers: who you're connected to, and who is connected to you. */
function ConnectionCounts({ connections }: { connections: ConnectionsResponse | null }) {
  const items = [
    { label: "You're connected to", value: connections?.connectedTo.length },
    { label: "Connected to you", value: connections?.connectedToMe.length },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 p-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-brand-50 px-3 py-2.5 dark:bg-brand-500/10">
          <dt className="text-xs font-medium text-brand-800 dark:text-brand-200">{item.label}</dt>
          <dd className="font-display text-2xl font-semibold text-neutral-900 tabular-nums dark:text-white">{item.value ?? "–"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChatList({
  chats,
  openId,
  onOpen,
  onFindPeople,
}: {
  chats: ChatConversation[] | null;
  openId: string | null;
  onOpen: (id: string) => void;
  onFindPeople: () => void;
}) {
  if (!chats) return <p className="px-3 py-6 text-sm text-neutral-500 dark:text-neutral-400">Loading chats…</p>;
  if (!chats.length) {
    return (
      <div className="px-3 py-8 text-center">
        <p className="font-semibold text-neutral-900 dark:text-white">No chats yet</p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Connect with someone, then send them a message.</p>
        <button type="button" onClick={onFindPeople} className="mt-3 text-sm font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
          Find people
        </button>
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {chats.map((chat) => (
        <li key={chat.id}>
          <button
            type="button"
            id={`chat-item-${chat.id}`}
            onClick={() => onOpen(chat.id)}
            aria-current={chat.id === openId ? "true" : undefined}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 ${
              chat.id === openId ? "bg-brand-50 dark:bg-brand-500/15" : "hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
            }`}
          >
            <Avatar name={chat.person.name} className="size-10 text-sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold text-neutral-900 dark:text-white">{chat.person.name}</span>
                <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">{chat.lastMessage ? shortTime(chat.lastMessageAt) : ""}</span>
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-neutral-500 dark:text-neutral-400">{chat.lastMessage ?? "No messages yet"}</span>
                {chat.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                    {chat.unread}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PeoplePanel({
  connections,
  onMessage,
  onConnection,
  onError,
}: {
  connections: ConnectionsResponse | null;
  onMessage: (person: Person) => void;
  onConnection: (person: Person, kind: ConnectionKind | null) => Promise<void>;
  onError: (e: ApiError) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[] | null>(null);
  const trimmed = query.trim();

  // Search a moment after typing stops. A newer search replaces an older one that's still running.
  useEffect(() => {
    if (trimmed.length < 2) return;
    let live = true;
    const timer = setTimeout(async () => {
      const result = await searchPeople(trimmed);
      if (!live) return;
      if (result.ok) setResults(result.data);
      else onError(result.error);
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [trimmed, onError, connections]);

  const searching = trimmed.length >= 2;
  return (
    <div className="space-y-4 px-2">
      <div>
        <label htmlFor="people-search" className="sr-only">
          Find people by name or email
        </label>
        <input
          id="people-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find people by name or email"
          autoComplete="off"
          className="block w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>
      {searching ? (
        <PeopleSection title="Search results" people={results} empty="No one found. Try their full name, or the exact email they signed up with." onMessage={onMessage} onConnection={onConnection} />
      ) : (
        <>
          <PeopleSection title="You're connected to" people={connections?.connectedTo ?? null} empty="No one yet. Search above to find people." onMessage={onMessage} onConnection={onConnection} />
          <PeopleSection title="Connected to you" people={connections?.connectedToMe ?? null} empty="No one has connected to you yet." onMessage={onMessage} onConnection={onConnection} />
        </>
      )}
    </div>
  );
}

function PeopleSection({
  title,
  people,
  empty,
  onMessage,
  onConnection,
}: {
  title: string;
  people: Person[] | null;
  empty: string;
  onMessage: (person: Person) => void;
  onConnection: (person: Person, kind: ConnectionKind | null) => Promise<void>;
}) {
  return (
    <section>
      <h2 className="px-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
        {title}
        {people && people.length > 0 && <span className="ml-1.5 tabular-nums">{people.length}</span>}
      </h2>
      {!people ? (
        <p className="px-1 py-3 text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : !people.length ? (
        <p className="px-1 py-3 text-sm text-neutral-500 dark:text-neutral-400">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} onMessage={onMessage} onConnection={onConnection} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PersonRow({
  person,
  onMessage,
  onConnection,
}: {
  person: Person;
  onMessage: (person: Person) => void;
  onConnection: (person: Person, kind: ConnectionKind | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const canMessage = Boolean(person.connection) || person.connectedToMe;

  async function change(value: string) {
    setBusy(true);
    await onConnection(person, value === "remove" ? null : (value as ConnectionKind));
    setBusy(false);
  }

  return (
    <li className="rounded-2xl border border-neutral-200/80 p-3 dark:border-neutral-800">
      <div className="flex items-center gap-3">
        <Avatar name={person.name} className="size-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-neutral-900 dark:text-white">{person.name}</p>
          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {ROLE_LABEL[person.role]}
            {person.connectedToMe && " · Connected to you"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <select
          aria-label={person.connection ? `Your connection to ${person.name}` : `Connect to ${person.name} as`}
          value={person.connection ?? ""}
          disabled={busy}
          onChange={(e) => void change(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        >
          {!person.connection && (
            <option value="" disabled>
              Connect as…
            </option>
          )}
          {CONNECTION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {CONNECTION_KIND_LABEL[kind]}
            </option>
          ))}
          {person.connection && <option value="remove">Remove connection</option>}
        </select>
        <Button type="button" variant="secondary" disabled={!canMessage} onClick={() => onMessage(person)} className="shrink-0 px-4 py-2 text-sm" title={canMessage ? undefined : "Connect first to message"}>
          Message
        </Button>
      </div>
    </li>
  );
}

/** One open conversation: messages, polling for new ones, and the box to write in. */
function Thread({ id, onBack, onActivity, onError }: { id: string; onBack: () => void; onActivity: () => void; onError: (e: ApiError) => void }) {
  const [thread, setThread] = useState<Omit<ChatThreadResponse, "messages"> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const lastSeen = useRef<string | undefined>(undefined);
  const loadedOnce = useRef(false);
  // The message list only becomes a live region after the first load, so opening a chat doesn't read out its whole history.
  const [announce, setAnnounce] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  /** Adds messages that aren't on screen yet, keeping time order. */
  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id));
      const added = incoming.filter((m) => !known.has(m.id));
      return added.length ? [...current, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : current;
    });
  }, []);

  const load = useCallback(async () => {
    const result = await getChat(id, lastSeen.current);
    if (!result.ok) return onError(result.error);
    const { messages: incoming, ...rest } = result.data;
    setThread(rest);
    merge(incoming);
    const newest = incoming[incoming.length - 1]?.createdAt;
    if (newest && (!lastSeen.current || newest > lastSeen.current)) lastSeen.current = newest;
    // Opening the chat marks it read, and new messages change the menu's unread number.
    if (incoming.length || !loadedOnce.current) window.dispatchEvent(new Event(CHAT_CHANGED_EVENT));
    if (!loadedOnce.current) setTimeout(() => setAnnounce(true), 0);
    loadedOnce.current = true;
  }, [id, merge, onError]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), THREAD_POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    const result = await sendChatMessage(id, text);
    setSending(false);
    if (!result.ok) {
      setSendError(result.error.fieldErrors?.body ?? result.error.message);
      return;
    }
    setDraft("");
    merge([result.data]);
    if (!lastSeen.current || result.data.createdAt > lastSeen.current) lastSeen.current = result.data.createdAt;
    onActivity();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter makes a new line. Not while an input method is composing a character.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  const person = thread?.person;
  const hasPerson = Boolean(person);

  // On phones the chat list (and the button that opened this chat) is hidden now, so focus moves to the chat's name.
  useEffect(() => {
    if (hasPerson && focusLost()) heading.current?.focus();
  }, [hasPerson]);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className="grid size-9 place-items-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 focus-visible:ring-4 focus-visible:ring-brand-500/30 lg:hidden dark:hover:bg-neutral-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {person ? (
          <>
            <Avatar name={person.name} className="size-10 text-sm" />
            <div className="min-w-0">
              <h2 ref={heading} tabIndex={-1} className="truncate font-semibold text-neutral-900 outline-none dark:text-white">
                {person.name}
              </h2>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {ROLE_LABEL[person.role]}
                {person.connection && ` · ${CONNECTION_KIND_LABEL[person.connection]}`}
              </p>
            </div>
          </>
        ) : (
          <span className="h-10 w-40 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />
        )}
      </header>

      <div ref={scroller} className="scrollbar-slim min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4" role="log" aria-label="Messages" aria-live={announce ? "polite" : "off"}>
        {thread && !messages.length && <p className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">No messages yet. Say hello.</p>}
        {messages.map((m) => {
          const mine = m.senderId !== person?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
                  mine ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                }`}
              >
                <span className="sr-only">{mine ? "You: " : `${person?.name ?? "Them"}: `}</span>
                {m.body}
                <span className={`mt-0.5 block text-right text-[11px] ${mine ? "text-white/75" : "text-neutral-500 dark:text-neutral-400"}`}>{shortTime(m.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="border-t border-neutral-100 p-3 dark:border-neutral-800">
        {sendError && (
          <p role="alert" className="mb-2 px-1 text-sm text-red-600 dark:text-red-400">
            {sendError}
          </p>
        )}
        {thread && !thread.canSend ? (
          <p className="px-1 py-2 text-sm text-neutral-500 dark:text-neutral-400">
            You&apos;re no longer connected with {person?.name}. Connect again under People to send messages.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <label htmlFor="chat-message" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-message"
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={MAX_MESSAGE_CHARS}
              placeholder="Write a message"
              className="max-h-40 min-h-11 flex-1 resize-y rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-[15px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <Button type="submit" loading={sending} disabled={!draft.trim() || !thread} className="shrink-0 px-5 py-2.5 text-sm">
              Send
            </Button>
          </div>
        )}
      </form>
    </>
  );
}
