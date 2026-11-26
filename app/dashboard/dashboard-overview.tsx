"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiError, ChatConversation, DashboardStats, DeadlineItem, GeneratedFile, Submission, TailoredResumeWithFiles, VendorJd } from "@/lib/types";
import { getDashboardStats, listChats, listDeadlines, listSubmissions, listTailoredResumes, listVendorJds, logout } from "@/lib/client/api";
import { appliedCounts, daysBetween, localDate, nextDeadline, relativeDay, visibleDeadlines } from "@/lib/deadlines";
import { SidebarClocks } from "@/components/dashboard/us-clocks";
import { useCurrentUser } from "@/lib/client/current-user";
import { ErrorAlert } from "@/components/ui/alert";
import { OrbLink } from "@/components/ui/orb";
import { RingAvatar } from "@/components/ui/ring-avatar";

// The Dashboard home (Command Center): your numbers on the left, today's queue and your resumes in
// the middle, your chats on the right. Works in every theme color.

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
  const [deadlines, setDeadlines] = useState<DeadlineItem[] | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([getDashboardStats(), listTailoredResumes(), listSubmissions(), listVendorJds(), listDeadlines()]).then(async ([s, r, a, j, d]) => {
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
      setDeadlines(d.ok ? d.data : []);
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
      {(stats.status === "error" || resumes.status === "error") && (
        <div className="space-y-3">
          <ErrorAlert>{stats.status === "error" ? stats.message : resumes.status === "error" ? resumes.message : null}</ErrorAlert>
          <button type="button" onClick={retry} className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Try again
          </button>
        </div>
      )}

      {/* Command center: your numbers | today's queue and resumes | chat. Stacks on phones. */}
      <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
        <NumbersColumn stats={stats} resumes={resumes} applications={applications} jds={jds} deadlines={deadlines} />

        <section aria-label="Today" className={`${card} order-1 min-w-0 space-y-6 p-5 sm:p-6 lg:order-none`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">
                {firstName ? `${greeting()}, ${firstName}` : "Dashboard"}
              </h1>
              <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">Here&apos;s what to do next.</p>
            </div>
            <OrbLink href="/dashboard/jds" label="Add a JD" tone="teal" icon="plus" />
          </div>

          <TodaysQueue jds={jds} deadlines={deadlines} />

          <section aria-labelledby="my-resumes">
            <h2 id="my-resumes" className={sectionTitle}>
              My resumes
            </h2>
            <div className="mt-3">
              {resumes.status === "loading" && <ResumeListSkeleton />}
              {resumes.status === "ready" && (resumes.data.length ? <ResumeList items={resumes.data} /> : <EmptyState />)}
            </div>
          </section>
        </section>

        <ChatPanel />
      </div>
    </div>
  );
}

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/* ---------- Your numbers (left column) ---------- */

const monthName = new Intl.DateTimeFormat(undefined, { month: "short" });

function NumbersColumn({
  stats,
  resumes,
  applications,
  jds,
  deadlines,
}: {
  stats: Load<DashboardStats>;
  resumes: Load<TailoredResumeWithFiles[]>;
  applications: Load<Submission[]>;
  jds: VendorJd[] | null;
  deadlines: DeadlineItem[] | null;
}) {
  // Counted here, not on the server, so "this month" follows the viewer's own calendar.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const tailored = resumes.status === "ready" ? resumes.data.filter((r) => new Date(r.createdAt).getTime() >= monthStart).length : null;
  const applied = applications.status === "ready" ? appliedCounts(applications.data, now) : null;
  const ready = jds ? jds.filter((j) => j.tailored && !j.sentAt).length : null;
  const match = stats.status === "ready" ? stats.data.averageMatchPercent : null;
  const tiles: { label: string; value: string | null }[] = [
    { label: "Applied this month", value: applied ? String(applied.month) : null },
    { label: "Ready to send", value: ready === null ? null : String(ready) },
    { label: "Average match", value: stats.status !== "ready" ? null : match === null ? "—" : `${match}%` },
    { label: "Open jobs", value: stats.status === "ready" ? String(stats.data.jobs.total) : null },
  ];

  return (
    <aside aria-label="Your numbers" className="order-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:order-none lg:grid-cols-1">
      <div className="col-span-2 rounded-3xl bg-[linear-gradient(140deg,var(--color-brand-950),var(--color-brand-600))] p-5 text-white shadow-lg shadow-brand-950/20 sm:col-span-3 lg:col-span-1">
        <p className="text-xs text-white/75">Tailored in {monthName.format(now)}</p>
        <p className="mt-1 text-5xl leading-none font-light tabular-nums">{tailored ?? "—"}</p>
      </div>
      {tiles.map((t) => (
        <div key={t.label} className={`${card} px-4 py-3`}>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.label}</p>
          {t.value === null ? (
            <span className="mt-1 block h-6 w-10 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />
          ) : (
            <p className="text-2xl font-bold text-neutral-900 tabular-nums dark:text-white">{t.value}</p>
          )}
        </div>
      ))}
      <NextUp deadlines={deadlines} />
      <div className="col-span-2 sm:col-span-3 lg:col-span-1">
        <SidebarClocks />
      </div>
    </aside>
  );
}

/** The soonest open deadline as a small peach card. */
function NextUp({ deadlines }: { deadlines: DeadlineItem[] | null }) {
  const today = localDate(new Date());
  const next = deadlines ? nextDeadline(visibleDeadlines(deadlines, today)) : null;
  if (!next?.dueOn) return null;
  const body = (
    <>
      <p className="text-[11px] font-bold tracking-wider text-orange-800 uppercase dark:text-orange-200">Next · {relativeDay(next.dueOn, today)}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{next.title}</p>
    </>
  );
  const cls = "col-span-2 block rounded-3xl bg-orange-100 px-4 py-3 sm:col-span-1 lg:col-span-1 dark:bg-orange-500/15";
  return next.href ? (
    <Link href={next.href} className={`${cls} outline-none hover:brightness-[1.03] focus-visible:ring-4 focus-visible:ring-brand-500/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ---------- Today's queue ---------- */

type QueueItem = { key: string; dot: string; title: string; detail: string; action: string; href: string; primary: boolean };

/**
 * What to do next, in order: JDs tailored and ready to send, deadlines in the coming week, then JDs
 * still waiting to be tailored. Each row has the one button that does it.
 */
function TodaysQueue({ jds, deadlines }: { jds: VendorJd[] | null; deadlines: DeadlineItem[] | null }) {
  if (jds === null || deadlines === null) {
    return (
      <div className="space-y-2.5" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-16 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
        ))}
      </div>
    );
  }
  const today = localDate(new Date());
  const pct = (jd: VendorJd) => (jd.tailored?.finalMatchPercent === null || jd.tailored?.finalMatchPercent === undefined ? "" : ` · ${jd.tailored.finalMatchPercent}% match`);
  const where = (jd: VendorJd) => [jd.vendorCompany, jd.location].filter(Boolean).join(" · ");
  const items: QueueItem[] = [
    ...jds
      .filter((jd) => jd.tailored && !jd.sentAt)
      .map((jd) => ({ key: `send-${jd.id}`, dot: "bg-blue-600", title: jd.title, detail: `${where(jd)}${pct(jd)} · ready to send`, action: "Send", href: "/dashboard/jds", primary: true })),
    ...visibleDeadlines(deadlines, today)
      .filter((d) => !d.done && d.dueOn && daysBetween(today, d.dueOn) <= 7)
      .map((d) => ({
        key: `due-${d.id}`,
        dot: d.kind === "interview" ? "bg-rose-500" : "bg-amber-500",
        title: d.title,
        detail: `${relativeDay(d.dueOn!, today)} · ${d.detail}`,
        action: d.kind === "interview" ? "Prep" : "Open",
        href: d.href ?? "/dashboard/spreadsheet",
        primary: false,
      })),
    ...jds
      .filter((jd) => !jd.tailored)
      .map((jd) => ({ key: `tailor-${jd.id}`, dot: "bg-neutral-400", title: jd.title, detail: `${where(jd)} · not tailored yet`, action: "Tailor", href: "/dashboard/jds", primary: false })),
  ].slice(0, 6);

  return (
    <section aria-labelledby="queue-title">
      <h2 id="queue-title" className={sectionTitle}>
        Today&apos;s queue
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          You&apos;re all caught up.{" "}
          <Link href="/dashboard/jds" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Add a JD
          </Link>{" "}
          when a vendor sends one.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-3.5 rounded-2xl bg-neutral-50 px-4 py-3 dark:bg-white/5">
              <span className={`size-2.5 shrink-0 rounded-full ${item.dot}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-white">{item.title}</span>
                <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{item.detail}</span>
              </span>
              <Link
                href={item.href}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold outline-none focus-visible:ring-4 focus-visible:ring-brand-500/40 ${
                  item.primary ? "pill-seg-on" : "border border-neutral-300 text-neutral-800 hover:bg-white dark:border-white/15 dark:text-neutral-100 dark:hover:bg-white/10"
                }`}
              >
                {item.action}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Chat (right column) ---------- */

const RECENT_CHATS = 5;
const chatTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const chatDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** "3:42 PM" for today, otherwise "Nov 9". */
function shortTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toDateString() === new Date().toDateString() ? chatTime.format(d) : chatDay.format(d);
}

/** A dark panel with your latest chats; each picture in its owner's ring, dim when they're away. */
function ChatPanel() {
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
    <section
      aria-labelledby="chat-title"
      className="order-3 flex flex-col gap-4 rounded-3xl lg:order-none xl:min-h-80 bg-[rgb(24_32_37/0.88)] p-5 text-neutral-100 shadow-lg backdrop-blur-xl lg:col-span-2 xl:col-span-1 dark:bg-white/5"
    >
      <div className="flex items-center justify-between">
        <h2 id="chat-title" className="text-[15px] font-semibold">
          Chat
        </h2>
        <OrbLink href="/dashboard/chat" label="Open Chat" tone="teal" icon="arrow" size="sm" onDark />
      </div>
      {chats === null ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-11 animate-pulse rounded-full bg-white/10" />
          ))}
        </div>
      ) : chats === "error" ? (
        <p className="text-sm text-neutral-300">Chats couldn&apos;t be loaded right now.</p>
      ) : chats.length === 0 ? (
        <p className="text-sm text-neutral-300">
          No chats yet.{" "}
          <Link href="/dashboard/chat" className="font-semibold text-white underline-offset-2 hover:underline">
            Connect with someone
          </Link>{" "}
          to start one.
        </p>
      ) : (
        <ul className="space-y-1">
          {chats.map((chat) => (
            <li key={chat.id}>
              <Link
                href={`/dashboard/chat?c=${encodeURIComponent(chat.id)}`}
                className="flex items-center gap-3 rounded-2xl p-2 outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <RingAvatar name={chat.person.name} photoUrl={chat.person.photoUrl} ring={chat.person.ring} online={chat.person.online} className="size-10" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`truncate text-sm ${chat.unread ? "font-bold text-white" : "font-semibold"}`}>{chat.person.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-neutral-400 tabular-nums">{shortTime(chat.lastMessageAt)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`truncate text-xs ${chat.unread ? "text-neutral-100" : "text-neutral-400"}`}>{chat.lastMessage ?? "No messages yet"}</span>
                    {chat.unread > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-blue-600 px-1.5 py-px text-[10px] font-semibold text-white tabular-nums">
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
