"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiError, DashboardStats, GeneratedFile, Submission, TailoredResumeWithFiles } from "@/lib/types";
import { getDashboardStats, listSubmissions, listTailoredResumes, logout } from "@/lib/client/api";
import { appliedCounts } from "@/lib/deadlines";
import { useCurrentUser } from "@/lib/client/current-user";
import { ErrorAlert } from "@/components/ui/alert";
import { ScoreBadge } from "@/components/ui/score-badge";

type Load<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; message: string };

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

const primaryLink =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 font-display text-[15px] font-medium tracking-wider text-white uppercase shadow-md shadow-brand-600/30 transition hover:bg-brand-700 dark:hover:bg-brand-500";

export function DashboardOverview() {
  const router = useRouter();
  const user = useCurrentUser();
  const [stats, setStats] = useState<Load<DashboardStats>>({ status: "loading" });
  const [resumes, setResumes] = useState<Load<TailoredResumeWithFiles[]>>({ status: "loading" });
  const [applications, setApplications] = useState<Load<Submission[]>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([getDashboardStats(), listTailoredResumes(), listSubmissions()]).then(async ([s, r, a]) => {
      if (!active) return;
      if ([s, r, a].some((result) => !result.ok && isUnauthorized(result.error))) {
        await logout();
        router.replace("/login");
        return;
      }
      setStats(s.ok ? { status: "ready", data: s.data } : { status: "error", message: s.error.message });
      setResumes(r.ok ? { status: "ready", data: r.data } : { status: "error", message: r.error.message });
      setApplications(a.ok ? { status: "ready", data: a.data } : { status: "error", message: a.error.message });
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
  const hasResumes = resumes.status === "ready" && resumes.data.length > 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
            {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Your tailored resumes and how well they match the jobs you&apos;re going for.
          </p>
        </div>
        {hasResumes && (
          <Link href="/dashboard/upload" className={`${primaryLink} shrink-0`}>
            <PlusIcon />
            Tailor a resume
          </Link>
        )}
      </header>

      {(stats.status === "error" || resumes.status === "error") && (
        <div className="space-y-3">
          <ErrorAlert>
            {stats.status === "error" ? stats.message : resumes.status === "error" ? resumes.message : null}
          </ErrorAlert>
          <button type="button" onClick={retry} className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Try again
          </button>
        </div>
      )}

      <StatCards stats={stats} applications={applications} />

      <section aria-labelledby="my-resumes">
        <h2 id="my-resumes" className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
          My Resumes
        </h2>
        <div className="mt-4">
          {resumes.status === "loading" && <ResumeListSkeleton />}
          {resumes.status === "ready" && (resumes.data.length ? <ResumeList items={resumes.data} /> : <EmptyState />)}
        </div>
      </section>
    </div>
  );
}

/* ---------- Stats ---------- */

const monthName = new Intl.DateTimeFormat(undefined, { month: "long" });

function StatCards({ stats, applications }: { stats: Load<DashboardStats>; applications: Load<Submission[]> }) {
  if (stats.status === "error") return null;
  const s = stats.status === "ready" ? stats.data : null;
  // Counted here, not on the server, so "today" and "this week" follow the viewer's own calendar.
  const now = new Date();
  const applied = applications.status === "ready" ? appliedCounts(applications.data, now) : null;
  // null shows the loading bar; a dash means the applications couldn't be loaded.
  const appliedText = (n: number | undefined) => (n === undefined ? (applications.status === "error" ? "—" : null) : String(n));
  const cards = [
    { label: "Resumes Tailored", value: s && String(s.tailoredResumeCount), hint: "Ready to download", icon: <SparkIcon /> },
    { label: "Today", value: appliedText(applied?.today), hint: "Jobs applied today", icon: <SendIcon /> },
    { label: "This Week", value: appliedText(applied?.week), hint: "Applied since Monday", icon: <CalendarIcon /> },
    { label: "This Month", value: appliedText(applied?.month), hint: `Applied in ${monthName.format(now)}`, icon: <CalendarIcon /> },
    {
      label: "Open Jobs",
      value: s && String(s.jobs.total),
      hint: s ? `${s.jobs.native} on JobAssistant` : "On the job board",
      icon: <BriefcaseIcon />,
    },
  ];

  return (
    <section aria-label="Your stats" aria-busy={!s} className="-m-1 flex gap-3 overflow-x-auto p-1">
      {cards.map((card) => (
        // One strip at every width: the five share the row equally, and when they can't all fit
        // (phones) the strip scrolls sideways. Compact, so the icon shares the number's row.
        <div
          key={card.label}
          className="group relative min-w-34 flex-1 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-3 shadow-sm xl:p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900/60"
        >
          <span
            className="pointer-events-none absolute -right-10 -bottom-10 size-28 rounded-full bg-brand-500/5 transition group-hover:bg-brand-500/10"
            aria-hidden="true"
          />
          <p className="text-[13px] font-medium whitespace-nowrap text-neutral-500 xl:text-sm dark:text-neutral-400">{card.label}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            {card.value === null ? (
              <span className="block h-9 w-16 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />
            ) : (
              <p className="font-display text-4xl leading-9 font-semibold tracking-tight text-neutral-900 tabular-nums dark:text-white">
                {card.value}
              </p>
            )}
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              {card.icon}
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">{card.hint}</p>
        </div>
      ))}
    </section>
  );
}

/* ---------- Resume list ---------- */

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFormat.format(d);
}

const bulletsText = (n: number) => (n === 0 ? "No bullet changes" : `${n} ${n === 1 ? "bullet" : "bullets"} updated`);

function ResumeList({ items }: { items: TailoredResumeWithFiles[] }) {
  return (
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/60">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              <FileIcon />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-neutral-900 dark:text-white">Tailored resume</p>
              <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                <span className="mx-1.5 text-neutral-300 dark:text-neutral-600" aria-hidden="true">·</span>
                {bulletsText(item.acceptedBulletIds?.length ?? 0)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pl-15 sm:pl-0">
            <ScoreBadge percent={item.finalMatchPercent} />
            <div className="flex gap-2">
              <FileLink file={item.files.find((f) => f.format === "docx")} format="docx" />
              <FileLink file={item.files.find((f) => f.format === "pdf")} format="pdf" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const FILE_STYLES = {
  docx: { label: "DOCX", name: "Word", className: "mono-grayscale border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-500/30 dark:text-sky-300 dark:hover:bg-sky-500/10" },
  pdf: { label: "PDF", name: "PDF", className: "mono-grayscale border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10" },
} as const;

function FileLink({ file, format }: { file?: GeneratedFile; format: "docx" | "pdf" }) {
  const style = FILE_STYLES[format];
  const base = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide transition";
  if (!file) {
    return (
      <span
        className={`${base} cursor-not-allowed border-neutral-200 text-neutral-400 dark:border-neutral-800 dark:text-neutral-600`}
        title={`${style.name} file not available`}
      >
        {style.label}
      </span>
    );
  }
  return (
    <a href={file.downloadUrl} download={file.fileName} className={`${base} ${style.className}`} aria-label={`Download ${style.name} (${file.fileName})`}>
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
      {style.label}
    </a>
  );
}

function ResumeListSkeleton() {
  return (
    <div className="divide-y divide-neutral-100 rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900/60" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 sm:px-6">
          <span className="size-11 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          <div className="flex-1 space-y-2">
            <span className="block h-4 w-48 max-w-full animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
            <span className="block h-3 w-24 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
          <span className="hidden h-7 w-40 animate-pulse rounded-full bg-neutral-100 sm:block dark:bg-neutral-800" />
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

const ICON = "size-5";

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
      <path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={ICON} aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
      <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
