"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiError, ChatConversation, DashboardStats, DeadlineItem, GeneratedFile, Submission, TailoredResumeWithFiles, VendorJd } from "@/lib/types";
import { getDashboardStats, listChats, listDeadlines, listSubmissions, listTailoredResumes, listVendorJds, logout, updateDeadline } from "@/lib/client/api";
import { appliedCounts, daysBetween, localDate, nextDeadline, relativeDay, visibleDeadlines } from "@/lib/deadlines";
import { useCurrentUser } from "@/lib/client/current-user";
import { ErrorAlert } from "@/components/ui/alert";
import { OrbButton, OrbLink } from "@/components/ui/orb";
import { RingAvatar } from "@/components/ui/ring-avatar";

// The Dashboard home (Gray Glass design): a big card with this month's numbers, the next deadline,
// then your tailored resumes, your chats and where your JDs are. Works in every theme color.

type Load<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

const primaryLink =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 font-display text-[15px] font-medium tracking-wider text-white uppercase shadow-md shadow-brand-600/30 transition hover:bg-brand-700 dark:hover:bg-brand-500";

const card = "rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60";
const sectionTitle = "text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white";

export function DashboardOverview() {
  const router = useRouter();
  const user = useCurrentUser();
  const [stats, setStats] = useState<Load<DashboardStats>>({ status: "loading" });
  const [resumes, setResumes] = useState<Load<TailoredResumeWithFiles[]>>({ status: "loading" });
  const [applications, setApplications] = useState<Load<Submission[]>>({ status: "loading" });
  const [jds, setJds] = useState<VendorJd[] | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([getDashboardStats(), listTailoredResumes(), listSubmissions(), listVendorJds()]).then(async ([s, r, a, j]) => {
      if (!active) return;
      if ([s, r, a].some((result) => !result.ok && isUnauthorized(result.error))) {
        await logout();
        router.replace("/login");
        return;
      }
      setStats(s.ok ? { status: "ready", data: s.data } : { status: "error", message: s.error.message });
      setResumes(r.ok ? { status: "ready", data: r.data } : { status: "error", message: r.error.message });
      setApplications(a.ok ? { status: "ready", data: a.data } : { status: "error", message: a.error.message });
      setJds(j.ok ? j.data.jds : []);
    });
    return () => {
      active = false;
    };
  }, [attempt, router]);

  function retry() {
    setStats({ status: "loading" });
    setResumes({ status: "loading" });
    setApplications({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
            {firstName ? `${greeting()}, ${firstName}` : "Dashboard"}
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">Your resumes, your JDs and what&apos;s next.</p>
        </div>
        <nav aria-label="Dashboard views" className="pill-glass flex gap-1 rounded-full p-1 text-sm font-medium">
          <Link href="/dashboard" aria-current="page" className="pill-seg-on rounded-full px-4 py-2 sm:px-5">
            Overview
          </Link>
          <Link href="/dashboard/jds" className="pill-seg-off rounded-full px-4 py-2 transition hover:opacity-80 sm:px-5">
            My JDs
          </Link>
          <Link href="/dashboard/chat?tab=people" className="pill-seg-off rounded-full px-4 py-2 transition hover:opacity-80 sm:px-5">
            Vendors
          </Link>
        </nav>
      </header>

      {(stats.status === "error" || resumes.status === "error") && (
        <div className="space-y-3">
          <ErrorAlert>{stats.status === "error" ? stats.message : resumes.status === "error" ? resumes.message : null}</ErrorAlert>
          <button type="button" onClick={retry} className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Try again
          </button>
        </div>
      )}

      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <HeroCard stats={stats} resumes={resumes} applications={applications} jds={jds} />
        <NextDeadlineCard />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <section aria-labelledby="my-resumes" className="min-w-0">
          <h2 id="my-resumes" className={sectionTitle}>
            My resumes
          </h2>
          <div className="mt-3">
            {resumes.status === "loading" && <ResumeListSkeleton />}
            {resumes.status === "ready" && (resumes.data.length ? <ResumeList items={resumes.data} /> : <EmptyState />)}
          </div>
        </section>
        <RecentChats />
        <JobLocations jds={jds} />
      </div>
    </div>
  );
}

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/* ---------- The big card ---------- */

const monthName = new Intl.DateTimeFormat(undefined, { month: "long" });

/** This month's tailored resumes in big type, with applications, ready-to-send JDs and open jobs under it. */
function HeroCard({
  stats,
  resumes,
  applications,
  jds,
}: {
  stats: Load<DashboardStats>;
  resumes: Load<TailoredResumeWithFiles[]>;
  applications: Load<Submission[]>;
  jds: VendorJd[] | null;
}) {
  // Counted here, not on the server, so "this month" follows the viewer's own calendar.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const tailored = resumes.status === "ready" ? resumes.data.filter((r) => new Date(r.createdAt).getTime() >= monthStart).length : null;
  const applied = applications.status === "ready" ? appliedCounts(applications.data, now) : null;
  const ready = jds ? jds.filter((j) => j.tailored && !j.sentAt).length : null;
  const openJobs = stats.status === "ready" ? stats.data.jobs.total : null;
  const facts: { label: string; value: number | null }[] = [
    { label: "Applied this week", value: applied?.week ?? null },
    { label: "Applied this month", value: applied?.month ?? null },
    { label: "Ready to send", value: ready },
    { label: "Open jobs", value: openJobs },
  ];

  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex min-h-64 overflow-hidden rounded-3xl bg-[linear-gradient(115deg,var(--color-brand-950)_0%,var(--color-brand-700)_55%,var(--color-brand-400)_100%)] p-6 pb-20 text-white shadow-lg shadow-brand-950/20 sm:p-8 sm:pb-20"
    >
      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-4">
        <h2 id="hero-title" className="text-sm font-medium text-white/80">
          Resumes tailored in {monthName.format(now)}
        </h2>
        <p className="text-7xl leading-none font-light tracking-tight tabular-nums">
          {tailored ?? <span className="inline-block h-16 w-20 animate-pulse rounded-xl bg-white/15 align-bottom" aria-label="Loading" />}
        </p>
        <dl className="flex flex-wrap gap-x-6 gap-y-3">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-white/70">{f.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{f.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ResumeArt />
      <div className="absolute right-5 bottom-5 z-10 flex gap-3">
        <OrbLink href="/dashboard/jds" label="Add a JD" tone="teal" icon="plus" size="lg" onDark />
        <OrbLink href="/dashboard/spreadsheet" label="See everything in the Spreadsheet" tone="silver" icon="arrow" size="lg" onDark />
      </div>
    </section>
  );
}

/** A resume page with a green check and a dashed flight path: the big card's picture. */
function ResumeArt() {
  return (
    <svg viewBox="0 0 240 200" className="mono-grayscale pointer-events-none hidden h-48 w-auto shrink-0 self-center sm:block" aria-hidden="true">
      <rect x="40" y="30" width="110" height="140" rx="12" fill="#fff" fillOpacity=".22" transform="rotate(-10 95 100)" />
      <rect x="60" y="24" width="112" height="146" rx="12" fill="#fff" fillOpacity=".92" />
      <rect x="76" y="44" width="52" height="7" rx="3.5" className="fill-brand-700" />
      <rect x="76" y="58" width="80" height="6" rx="3" fill="#dfe1e7" />
      <rect x="76" y="72" width="70" height="6" rx="3" fill="#dfe1e7" />
      <rect x="76" y="86" width="76" height="6" rx="3" className="fill-brand-200" />
      <rect x="76" y="100" width="60" height="6" rx="3" fill="#dfe1e7" />
      <path d="M150 120l46-28" stroke="#fff" strokeWidth="3" strokeDasharray="4 6" />
      <path d="M196 72l24 10-10 4-4 10z" fill="#ffd36e" />
      <circle cx="96" cy="150" r="16" fill="#22c58b" />
      <path d="m88 150 6 6 10-11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Next deadline ---------- */

/** The soonest open deadline from the tracker, with a ring that fills over its last week. */
function NextDeadlineCard() {
  const [items, setItems] = useState<DeadlineItem[] | null | "error">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    listDeadlines().then((result) => {
      if (active) setItems(result.ok ? result.data : "error");
    });
    return () => {
      active = false;
    };
  }, []);

  const today = localDate(new Date());
  const visible = Array.isArray(items) ? visibleDeadlines(items, today) : [];
  const next = nextDeadline(visible);
  const others = visible.filter((i) => !i.done && i.dueOn && i !== next).length;
  const days = next?.dueOn ? daysBetween(today, next.dueOn) : null;
  // Full when due (or late); empty a week out.
  const fill = days === null ? 0 : Math.min(1, Math.max(0, 1 - days / 7));

  async function markDone(item: DeadlineItem) {
    setBusy(true);
    const result = await updateDeadline(item.id, true);
    setBusy(false);
    if (result.ok) setItems((list) => (Array.isArray(list) ? list.map((i) => (i.id === item.id ? result.data : i)) : list));
  }

  return (
    <section aria-labelledby="next-deadline" className={`${card} flex flex-col gap-3 p-6`}>
      <h2 id="next-deadline" className={sectionTitle}>
        Next deadline
      </h2>
      {items === null ? (
        <div className="space-y-3" aria-busy="true">
          <span className="block h-12 w-24 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
          <span className="block h-4 w-3/4 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
        </div>
      ) : items === "error" ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Deadlines couldn&apos;t be loaded right now.</p>
      ) : !next?.dueOn ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nothing due. Add a deadline from the tracker at the bottom of the menu.</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">{relativeDay(next.dueOn, today)}</p>
            <svg viewBox="0 0 80 80" className="size-18 shrink-0 -rotate-90" aria-hidden="true">
              <circle cx="40" cy="40" r="32" fill="none" strokeWidth="9" className="stroke-neutral-200 dark:stroke-white/10" />
              <circle cx="40" cy="40" r="32" fill="none" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${fill * 201} 201`} className="stroke-brand-600 dark:stroke-brand-300" />
            </svg>
          </div>
          <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            <span className="font-semibold text-neutral-900 dark:text-white">{next.title}.</span> {next.detail}
          </p>
          <div className="mt-auto flex items-center gap-3 pt-2">
            <span className="flex-1 text-xs text-neutral-500 dark:text-neutral-400">
              {others ? `${others} more coming up` : "Nothing else coming up"}
            </span>
            {next.kind === "custom" && <OrbButton label="Mark done" tone="pink" icon="check" disabled={busy} onClick={() => void markDone(next)} />}
            {next.href && <OrbLink href={next.href} label="Open" tone="silver" icon="arrow" />}
          </div>
        </>
      )}
    </section>
  );
}

/* ---------- Recent chats ---------- */

const RECENT_CHATS = 4;
const chatTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const chatDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** "3:42 PM" for today, otherwise "Nov 9". */
function shortTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toDateString() === new Date().toDateString() ? chatTime.format(d) : chatDay.format(d);
}

/** The most recent conversations as glass pills, each picture in its owner's ring (dim when they're away). */
function RecentChats() {
  const [chats, setChats] = useState<ChatConversation[] | null | "error">(null);

  useEffect(() => {
    let active = true;
    listChats().then((result) => {
      if (!active) return;
      setChats(result.ok ? [...result.data].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)).slice(0, RECENT_CHATS) : "error");
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby="recent-chats" className="min-w-0">
      <div className="flex items-center justify-between">
        <h2 id="recent-chats" className={sectionTitle}>
          Chats
        </h2>
        <OrbLink href="/dashboard/chat" label="Open Chat" tone="teal" icon="arrow" size="sm" />
      </div>
      <div className="mt-3">
        {chats === null ? (
          <div className="space-y-2.5" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="block h-14 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
            ))}
          </div>
        ) : chats === "error" ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Chats couldn&apos;t be loaded right now.</p>
        ) : chats.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No chats yet.{" "}
            <Link href="/dashboard/chat" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Connect with someone
            </Link>{" "}
            to start one.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {chats.map((chat) => (
              <li key={chat.id}>
                <Link
                  href={`/dashboard/chat?c=${encodeURIComponent(chat.id)}`}
                  className="pill-glass flex items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40"
                >
                  <RingAvatar name={chat.person.name} photoUrl={chat.person.photoUrl} ring={chat.person.ring} online={chat.person.online} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={`truncate text-sm text-neutral-900 dark:text-white ${chat.unread ? "font-bold" : "font-semibold"}`}>{chat.person.name}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-neutral-500 tabular-nums dark:text-neutral-400">{shortTime(chat.lastMessageAt)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-xs ${chat.unread ? "text-neutral-800 dark:text-neutral-200" : "text-neutral-500 dark:text-neutral-400"}`}>
                        {chat.lastMessage ?? "No messages yet"}
                      </span>
                      {chat.unread > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-semibold text-white tabular-nums">
                          {chat.unread > 99 ? "99+" : chat.unread}
                          <span className="sr-only"> unread</span>
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------- Where your jobs are ---------- */

/** "Dallas, TX (Hybrid)" -> "TX"; "Remote" stays "Remote"; anything else is kept as typed. */
function placeOf(location: string): string {
  const text = location.replace(/\(.*?\)/g, "").trim();
  if (!text) return "";
  if (/remote/i.test(text)) return "Remote";
  const state = text.match(/,\s*([A-Z]{2})\b/);
  return state ? state[1] : text;
}

/** The top places across your JDs, on a dotted map card. */
function JobLocations({ jds }: { jds: VendorJd[] | null }) {
  const counts = new Map<string, number>();
  for (const jd of jds ?? []) {
    const place = placeOf(jd.location);
    if (place) counts.set(place, (counts.get(place) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <section aria-labelledby="job-places" className="min-w-0">
      <h2 id="job-places" className={sectionTitle}>
        Where your JDs are
      </h2>
      <div
        className={`${card} relative mt-3 h-52 overflow-hidden bg-[radial-gradient(rgb(var(--brand-glow)/0.22)_1.6px,transparent_1.8px)] [background-size:11px_11px] p-4`}
      >
        {jds === null ? (
          <span className="block h-full animate-pulse rounded-2xl bg-neutral-100/60 dark:bg-neutral-800/60" aria-busy="true" />
        ) : top.length === 0 ? (
          <p className="relative max-w-56 rounded-2xl bg-white/90 p-3 text-sm text-neutral-600 shadow-sm dark:bg-neutral-900/90 dark:text-neutral-300">
            Add JDs in{" "}
            <Link href="/dashboard/jds" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              My JDs
            </Link>{" "}
            to see where your jobs are.
          </p>
        ) : (
          <>
            <span aria-hidden="true" className="absolute top-[58%] left-[24%] grid size-13 place-items-center rounded-full bg-brand-500/20">
              <span className="size-3 rounded-full border-[3px] border-white bg-brand-600 dark:border-neutral-900" />
            </span>
            {top.length > 1 && (
              <span aria-hidden="true" className="absolute top-[40%] left-[74%] grid size-10 place-items-center rounded-full bg-rose-500/20">
                <span className="size-2.5 rounded-full border-[3px] border-white bg-rose-500 dark:border-neutral-900" />
              </span>
            )}
            <ol className="relative w-fit space-y-1 rounded-2xl bg-white/90 px-3.5 py-2.5 shadow-md dark:bg-neutral-900/90">
              {top.map(([place, n]) => (
                <li key={place} className="flex items-baseline gap-3 text-sm">
                  <span className="font-semibold text-neutral-900 dark:text-white">{place}</span>
                  <span className="ml-auto text-xs text-neutral-500 tabular-nums dark:text-neutral-400">{Math.round((n / total) * 100)}% of JDs</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------- Resume list ---------- */

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFormat.format(d);
}

/** Each tailored resume with its match as a bar, and its two downloads. Long lists scroll inside the card. */
function ResumeList({ items }: { items: TailoredResumeWithFiles[] }) {
  return (
    <ul className={`${card} max-h-80 space-y-3.5 overflow-y-auto p-4`}>
      {items.map((item) => {
        const pct = item.finalMatchPercent;
        return (
          <li key={item.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <time dateTime={item.createdAt} className="min-w-0 flex-1 truncate text-[13px] font-semibold text-neutral-900 dark:text-white">
                {formatDate(item.createdAt)}
              </time>
              <span className="text-xs font-semibold text-neutral-600 tabular-nums dark:text-neutral-300">{pct === null || pct === undefined ? "—" : `${pct}%`}</span>
              <FileLink file={item.files.find((f) => f.format === "docx")} format="docx" />
              <FileLink file={item.files.find((f) => f.format === "pdf")} format="pdf" />
            </div>
            <div className="h-2 rounded-full bg-neutral-200/70 dark:bg-white/10" role="presentation">
              <div
                className={`h-full rounded-full ${pct === null || pct === undefined ? "" : pct >= 75 ? "bg-brand-600 dark:bg-brand-300" : pct >= 50 ? "bg-brand-400" : "bg-neutral-400"}`}
                style={{ width: `${pct ?? 0}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const FILE_STYLES = {
  docx: { label: "W", name: "Word", className: "mono-grayscale bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25" },
  pdf: { label: "PDF", name: "PDF", className: "mono-grayscale bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25" },
} as const;

/** A tiny download button: "W" for the Word file, "PDF" for the PDF. */
function FileLink({ file, format }: { file?: GeneratedFile; format: "docx" | "pdf" }) {
  const style = FILE_STYLES[format];
  const base = "grid size-7 shrink-0 place-items-center rounded-lg text-[9px] font-extrabold tracking-wide transition focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none";
  if (!file) {
    return (
      <span className={`${base} cursor-not-allowed bg-neutral-100 text-neutral-300 dark:bg-neutral-800 dark:text-neutral-600`} title={`${style.name} file not available`}>
        {style.label}
      </span>
    );
  }
  return (
    <a href={file.downloadUrl} download={file.fileName} title={`Download ${style.name}`} className={`${base} ${style.className}`} aria-label={`Download ${style.name} (${file.fileName})`}>
      {style.label}
    </a>
  );
}

function ResumeListSkeleton() {
  return (
    <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/60" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2 px-3.5 py-3">
          <span className="block h-3.5 flex-1 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
          <span className="h-5 w-10 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
          <span className="size-7 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
          <span className="size-7 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center dark:border-neutral-700 dark:bg-neutral-900/40">
      <EmptyIllustration />
      <h3 className="mt-6 text-lg font-semibold text-neutral-900 dark:text-white">No tailored resumes yet</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        Upload your resume, paste a job description, and we&apos;ll help you match it. Your downloads will show up here.
      </p>
      <Link href="/dashboard/upload" className={`${primaryLink} mt-7`}>
        <PlusIcon />
        Tailor Your First Resume
      </Link>
    </div>
  );
}

/** Two stacked documents with a sparkle: a resume about to be tailored. */
function EmptyIllustration() {
  return (
    <svg viewBox="0 0 200 150" className="mono-grayscale mx-auto h-36 w-auto" aria-hidden="true">
      <ellipse cx="100" cy="138" rx="62" ry="7" className="fill-neutral-100 dark:fill-neutral-800/70" />
      <g transform="rotate(-8 82 70)">
        <rect x="44" y="20" width="76" height="100" rx="10" className="fill-neutral-100 stroke-neutral-200 dark:fill-neutral-800 dark:stroke-neutral-700" strokeWidth="2" />
      </g>
      <rect x="72" y="14" width="80" height="106" rx="10" className="fill-white stroke-neutral-200 dark:fill-neutral-900 dark:stroke-neutral-700" strokeWidth="2" />
      <circle cx="92" cy="38" r="9" className="fill-brand-100 dark:fill-brand-500/25" />
      <rect x="106" y="32" width="34" height="5" rx="2.5" className="fill-neutral-300 dark:fill-neutral-600" />
      <rect x="106" y="41" width="22" height="4" rx="2" className="fill-neutral-200 dark:fill-neutral-700" />
      {[60, 70, 80, 94, 104].map((y, i) => (
        <rect key={y} x="84" y={y} width={i % 2 ? 44 : 56} height="4" rx="2" className="fill-neutral-200 dark:fill-neutral-700" />
      ))}
      <circle cx="152" cy="112" r="20" className="fill-brand-600" />
      <path d="M152 102v20M142 112h20" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M160 22l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" className="fill-amber-400" />
      <path d="M40 104l1.6 3.8 3.8 1.6-3.8 1.6-1.6 3.8-1.6-3.8-3.8-1.6 3.8-1.6z" className="fill-brand-300 dark:fill-brand-400" />
    </svg>
  );
}

/* ---------- Icons ---------- */


function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
    </svg>
  );
}
