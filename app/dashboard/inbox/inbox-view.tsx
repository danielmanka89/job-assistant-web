"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteEmail, getEmail, listEmails, logout, sendEmail } from "@/lib/client/api";
import {
  MAX_EMAIL_BODY_CHARS,
  MAX_EMAIL_SUBJECT_CHARS,
  type ApiError,
  type EmailDetail,
  type EmailListResponse,
  type EmailSummary,
} from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

const LIST_POLL_MS = 30000; // new mail

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** "3:42 PM" for today, otherwise "Nov 9". */
function shortTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toDateString() === new Date().toDateString() ? timeFormat.format(d) : dayFormat.format(d);
}

function fullTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : fullFormat.format(d);
}

/** Who an email is with: the sender of a received one, the recipient of a sent one. */
const otherParty = (e: EmailSummary) => (e.direction === "in" ? e.fromName || e.fromAddress : e.toAddress);

type Box = "in" | "out";
type Draft = { to: string; subject: string; body: string; replyToId?: string };
/** What the right-hand side shows. */
type Pane = { kind: "none" } | { kind: "read"; id: string } | { kind: "write"; draft: Draft };

const panel = "rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60";
const iconButton =
  "grid size-9 place-items-center rounded-lg text-neutral-500 outline-none hover:bg-neutral-100 focus-visible:ring-4 focus-visible:ring-brand-500/30 dark:hover:bg-neutral-800";

/** The email list on one side, the open email (or the one being written) on the other. On phones one of the two shows at a time. */
export function InboxView() {
  const router = useRouter();
  const [box, setBox] = useState<Box>("in");
  const [inbox, setInbox] = useState<EmailListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>({ kind: "none" });

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
    const result = await listEmails();
    if (!result.ok) return void fail(result.error);
    setError(null);
    setInbox(result.data);
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

  const emails = inbox?.emails.filter((e) => e.direction === box) ?? null;
  const unread = inbox?.emails.filter((e) => e.unread).length ?? 0;
  const openId = pane.kind === "read" ? pane.id : null;

  function open(id: string) {
    setPane({ kind: "read", id });
    // Shown as read at once; the server marks it when the email loads.
    setInbox((current) => current && { ...current, emails: current.emails.map((e) => (e.id === id ? { ...e, unread: false } : e)) });
  }

  function sent() {
    setPane({ kind: "none" });
    setBox("out");
    void refresh();
  }

  function removed(id: string) {
    setPane({ kind: "none" });
    setInbox((current) => current && { ...current, emails: current.emails.filter((e) => e.id !== id) });
  }

  return (
    <div className="space-y-4">
      {error && <ErrorAlert>{error}</ErrorAlert>}
      {inbox && !inbox.address && <SetupNotice />}
      <div className="grid gap-4 lg:h-[calc(100dvh-17rem)] lg:min-h-[28rem] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section aria-label="Your emails" className={`${panel} flex min-h-0 flex-col ${pane.kind === "none" ? "flex" : "hidden lg:flex"}`}>
          <AddressCard inbox={inbox} onWrite={() => setPane({ kind: "write", draft: { to: "", subject: "", body: "" } })} />
          <div role="tablist" aria-label="Received or sent" className="mx-4 mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-800/70">
            {(["in", "out"] as const).map((b) => (
              <button
                key={b}
                type="button"
                role="tab"
                id={`inbox-tab-${b}`}
                aria-selected={box === b}
                aria-controls="inbox-panel"
                onClick={() => setBox(b)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 ${
                  box === b ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                {b === "in" ? "Received" : "Sent"}
                {b === "in" && unread > 0 && (
                  <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] text-white tabular-nums">
                    {unread > 99 ? "99+" : unread}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </button>
            ))}
          </div>
          <div role="tabpanel" id="inbox-panel" aria-labelledby={`inbox-tab-${box}`} className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <EmailList emails={emails} box={box} openId={openId} onOpen={open} />
          </div>
        </section>

        <section aria-label={pane.kind === "write" ? "New email" : "Email"} className={`${panel} min-h-0 flex-col ${pane.kind === "none" ? "hidden lg:flex" : "flex"}`}>
          {pane.kind === "read" && (
            <Reader
              key={pane.id}
              id={pane.id}
              canSend={Boolean(inbox?.canSend)}
              onBack={() => setPane({ kind: "none" })}
              onReply={(draft) => setPane({ kind: "write", draft })}
              onRemoved={removed}
              onError={fail}
            />
          )}
          {pane.kind === "write" && (
            <Composer
              key={pane.draft.replyToId ?? "new"}
              draft={pane.draft}
              from={inbox?.address ?? null}
              canSend={Boolean(inbox?.canSend)}
              onBack={() => setPane({ kind: "none" })}
              onSent={sent}
            />
          )}
          {pane.kind === "none" && (
            <p className="m-auto max-w-xs px-6 text-center text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              Choose an email to read it here.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="status">
      Email isn&apos;t set up on this site yet, so you don&apos;t have an address. Once it is, your address and your emails will show here.
    </div>
  );
}

/** Your address with a copy button, and the button that starts a new email. */
function AddressCard({ inbox, onWrite }: { inbox: EmailListResponse | null; onWrite: () => void }) {
  const [copied, setCopied] = useState(false);
  const address = inbox?.address ?? null;

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard access: the address is on screen and can be selected by hand.
    }
  }

  return (
    <div className="space-y-3 p-4">
      <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-950/60">
        <p className="text-xs font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">Your address</p>
        {inbox === null ? (
          <span className="mt-1.5 block h-5 w-56 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" aria-hidden="true" />
        ) : address ? (
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[13px] font-semibold break-all text-neutral-900 select-all dark:text-white">{address}</p>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-700 outline-none hover:bg-brand-50 focus-visible:ring-4 focus-visible:ring-brand-500/30 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              {copied ? "Copied" : "Copy"}
              <span className="sr-only"> your address</span>
            </button>
          </div>
        ) : (
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Not set up yet</p>
        )}
        <span className="sr-only" role="status">
          {copied ? "Address copied" : ""}
        </span>
        {address && !inbox?.canReceive && (
          <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">This site can&apos;t receive email yet, so mail sent to this address won&apos;t arrive.</p>
        )}
      </div>
      <Button type="button" onClick={onWrite} disabled={!inbox?.canSend} className="w-full py-2.5 text-sm">
        Write an email
      </Button>
      {inbox?.address && !inbox.canSend && (
        <p className="px-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">You can receive email here. Sending isn&apos;t turned on for this site yet.</p>
      )}
    </div>
  );
}

function EmailList({ emails, box, openId, onOpen }: { emails: EmailSummary[] | null; box: Box; openId: string | null; onOpen: (id: string) => void }) {
  if (emails === null) {
    return (
      <div className="space-y-2 px-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-16 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
        ))}
      </div>
    );
  }
  if (!emails.length) {
    return (
      <p className="px-4 py-10 text-center text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        {box === "in" ? "No email yet. Mail sent to your address shows up here." : "You haven't sent any email yet."}
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {emails.map((email) => {
        const who = otherParty(email);
        const active = email.id === openId;
        return (
          <li key={email.id}>
            <button
              type="button"
              onClick={() => onOpen(email.id)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 ${
                active ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
              }`}
            >
              <Avatar name={who} className="mt-0.5 size-9 text-xs" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`min-w-0 flex-1 truncate text-sm ${email.unread ? "font-bold text-neutral-900 dark:text-white" : "font-medium text-neutral-700 dark:text-neutral-200"}`}>
                    {box === "out" && <span className="font-normal text-neutral-500 dark:text-neutral-400">To: </span>}
                    {who}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">{shortTime(email.createdAt)}</span>
                </span>
                <span className={`block truncate text-sm ${email.unread ? "font-semibold text-neutral-900 dark:text-white" : "text-neutral-700 dark:text-neutral-300"}`}>{email.subject}</span>
                <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{email.preview}</span>
              </span>
              {email.unread && (
                <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-600">
                  <span className="sr-only">Unread</span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function BackButton({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button type="button" onClick={onBack} aria-label={label} className={`${iconButton} lg:hidden`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** "> " in front of every line, the way email quotes the message being answered. */
const quote = (body: string) => body.split("\n").map((line) => `> ${line}`).join("\n");

function Reader({
  id,
  canSend,
  onBack,
  onReply,
  onRemoved,
  onError,
}: {
  id: string;
  canSend: boolean;
  onBack: () => void;
  onReply: (draft: Draft) => void;
  onRemoved: (id: string) => void;
  onError: (e: ApiError) => void;
}) {
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let live = true;
    void getEmail(id).then((result) => {
      if (!live) return;
      if (result.ok) setEmail(result.data);
      else onError(result.error);
    });
    return () => {
      live = false;
    };
  }, [id, onError]);

  async function remove() {
    setDeleting(true);
    const result = await deleteEmail(id);
    setDeleting(false);
    if (!result.ok) return onError(result.error);
    onRemoved(id);
  }

  function reply() {
    if (!email) return;
    const subject = /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`;
    const header = `On ${fullTime(email.createdAt)}, ${email.fromName || email.fromAddress} wrote:`;
    onReply({ to: email.fromAddress, subject: subject.slice(0, MAX_EMAIL_SUBJECT_CHARS), body: `\n\n${header}\n${quote(email.body)}`.slice(0, MAX_EMAIL_BODY_CHARS), replyToId: email.id });
  }

  if (!email) {
    return (
      <div className="space-y-3 p-5" aria-busy="true">
        <BackButton onBack={onBack} label="Back to your emails" />
        <span className="block h-6 w-2/3 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />
        <span className="block h-4 w-1/3 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />
        <span className="block h-40 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />
      </div>
    );
  }

  const received = email.direction === "in";
  return (
    <>
      <header className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <BackButton onBack={onBack} label="Back to your emails" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-snug font-semibold break-words text-neutral-900 dark:text-white">{email.subject}</h2>
          <p className="mt-1 text-sm break-words text-neutral-600 dark:text-neutral-300">
            {received ? (
              <>
                From <span className="font-medium text-neutral-900 dark:text-white">{email.fromName || email.fromAddress}</span>
                {email.fromName && <span className="text-neutral-500 dark:text-neutral-400"> &lt;{email.fromAddress}&gt;</span>}
              </>
            ) : (
              <>
                To <span className="font-medium text-neutral-900 dark:text-white">{email.toAddress}</span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            <time dateTime={email.createdAt}>{fullTime(email.createdAt)}</time>
          </p>
        </div>
      </header>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {/* Plain text only: nothing in an email is ever rendered as HTML. */}
        <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap text-neutral-800 dark:text-neutral-100">{email.body || "(This email has no text.)"}</p>
        {email.attachments.length > 0 && (
          <div className="mt-5 rounded-2xl bg-neutral-50 p-3 text-sm dark:bg-neutral-950/60">
            <p className="font-medium text-neutral-700 dark:text-neutral-200">
              {email.attachments.length === 1 ? "1 attachment" : `${email.attachments.length} attachments`} (files aren&apos;t kept here; ask the sender for a link)
            </p>
            <ul className="mt-1 list-inside list-disc text-neutral-600 dark:text-neutral-300">
              {email.attachments.map((name, i) => (
                <li key={`${name}-${i}`} className="break-all">
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-neutral-100 p-3 dark:border-neutral-800">
        {received && (
          <Button type="button" onClick={reply} disabled={!canSend} className="px-5 py-2 text-sm">
            Reply
          </Button>
        )}
        {confirming ? (
          <>
            <span className="text-sm text-neutral-600 dark:text-neutral-300">Delete this email for good?</span>
            <Button type="button" onClick={remove} loading={deleting} className="px-4 py-2 text-sm">
              Delete
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={deleting} className="px-4 py-2 text-sm">
              Keep
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setConfirming(true)} className="px-5 py-2 text-sm">
            Delete
          </Button>
        )}
        {received && !canSend && <span className="text-xs text-neutral-500 dark:text-neutral-400">Sending isn&apos;t turned on for this site yet.</span>}
      </footer>
    </>
  );
}

function Composer({ draft, from, canSend, onBack, onSent }: { draft: Draft; from: string | null; canSend: boolean; onBack: () => void; onSent: () => void }) {
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    setFieldErrors({});
    const result = await sendEmail({ to: to.trim(), subject: subject.trim(), body, ...(draft.replyToId ? { replyToId: draft.replyToId } : {}) });
    setSending(false);
    if (result.ok) return onSent();
    setFieldErrors(result.error.fieldErrors ?? {});
    if (!result.error.fieldErrors) setError(result.error.message);
  }

  return (
    <form onSubmit={send} noValidate className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <BackButton onBack={onBack} label="Back to your emails" />
        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-900 dark:text-white">{draft.replyToId ? "Reply" : "New email"}</h2>
          {from && <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">From {from}</p>}
        </div>
      </header>
      <div className="scrollbar-slim min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {error && <ErrorAlert>{error}</ErrorAlert>}
        <TextField label="To" type="email" autoComplete="off" placeholder="name@example.com" value={to} onChange={(e) => setTo(e.target.value)} error={fieldErrors.to} />
        <TextField label="Subject" maxLength={MAX_EMAIL_SUBJECT_CHARS} value={subject} onChange={(e) => setSubject(e.target.value)} error={fieldErrors.subject} />
        <TextArea label="Message" rows={10} maxLength={MAX_EMAIL_BODY_CHARS} value={body} onChange={(e) => setBody(e.target.value)} error={fieldErrors.body} />
      </div>
      <footer className="flex items-center gap-2 border-t border-neutral-100 p-3 dark:border-neutral-800">
        <Button type="submit" loading={sending} disabled={!canSend} className="px-5 py-2 text-sm">
          Send
        </Button>
        <Button type="button" variant="secondary" onClick={onBack} disabled={sending} className="px-5 py-2 text-sm">
          Discard
        </Button>
      </footer>
    </form>
  );
}
