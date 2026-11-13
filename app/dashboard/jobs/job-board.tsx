"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSubmission, listJobPitches, listJobs, listSubmissions, logout } from "@/lib/client/api";
import type { JobPosting } from "@/lib/types";
import { storePendingJob } from "@/lib/client/jobs";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { JobCard, ROW_COLUMNS, STAGE_TONE } from "./job-card";
import { STAGES } from "@/lib/application-stage";
import { JOB_TYPES, JOB_TYPE_LABEL, type JobType } from "@/lib/job-types";

// The Posted filter: how recently a job was put on the board.
const POSTED_RANGES = [
  { key: "any", label: "Any time", hours: null },
  { key: "24h", label: "Last 24 hours", hours: 24 },
  { key: "48h", label: "Last 48 hours", hours: 48 },
  { key: "week", label: "Last week", hours: 24 * 7 },
  { key: "month", label: "Last month", hours: 24 * 30 },
] as const;
type PostedRange = (typeof POSTED_RANGES)[number]["key"];

function postedWithin(job: JobPosting, hours: number | null, now: number | null): boolean {
  if (hours === null || now === null) return true;
  const at = Date.parse(job.createdAt);
  return Number.isFinite(at) && now - at <= hours * 3_600_000;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; jobs: JobPosting[] };

export function JobBoard() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<JobType | "All">("All");
  const [postedFilter, setPostedFilter] = useState<PostedRange>("any");
  // The time the Posted filter counts back from, refreshed every minute (null until mounted).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [navigating, startNavigation] = useTransition();
  // Jobs with a row in the Spreadsheet, and the message about the latest Apply click.
  // The Spreadsheet Status of each job you applied to, by job id; it sets the row's color.
  const [statuses, setStatuses] = useState<Readonly<Record<string, string>>>({});
  const [notice, setNotice] = useState<{ id: number; text: string; error?: boolean } | null>(null);
  const noticeCount = useRef(0);
  // Your "Why should I hire you?" answers, by job id.
  const [pitches, setPitches] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    listJobPitches().then((result) => {
      if (active && result.ok) setPitches(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    // Only colors applied jobs; the board works without it.
    listSubmissions().then((result) => {
      if (!active || !result.ok) return;
      const found: Record<string, string> = {};
      for (const s of result.data) if (s.jobId) found[s.jobId] = s.submission.status ?? "";
      setStatuses((prev) => ({ ...found, ...prev }));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice((n) => (n?.id === notice.id ? null : n)), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let active = true;
    listJobs().then(async (result) => {
      if (!active) return;
      if (result.ok) {
        setState({ status: "ready", jobs: result.data });
        return;
      }
      if (result.error.code === "UNAUTHORIZED" || result.error.code === "HTTP_401") {
        await logout();
        router.replace("/login");
        return;
      }
      setState({ status: "error", message: result.error.message });
    });
    return () => {
      active = false;
    };
  }, [attempt, router]);

  const jobs = useMemo(() => (state.status === "ready" ? state.jobs : []), [state]);
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) =>
      [job.title, job.company, job.location, job.description].some((field) => field?.toLowerCase().includes(q)),
    );
  }, [jobs, query]);
  const postedHours = POSTED_RANGES.find((r) => r.key === postedFilter)?.hours ?? null;
  const searched = useMemo(() => matching.filter((job) => postedWithin(job, postedHours, now)), [matching, postedHours, now]);
  const postedCounts = POSTED_RANGES.map((r) => matching.filter((job) => postedWithin(job, r.hours, now)).length);
  // Split by position type: a job open to several types shows under each of them.
  const filtered = useMemo(
    () => (typeFilter === "All" ? searched : searched.filter((job) => job.employmentTypes.includes(typeFilter))),
    [searched, typeFilter],
  );
  const typeTabs = [
    { key: "All" as const, label: "All", count: searched.length },
    ...JOB_TYPES.map((t) => ({ key: t, label: JOB_TYPE_LABEL[t], count: searched.filter((job) => job.employmentTypes.includes(t)).length })),
  ];

  function tailorFor(job: JobPosting) {
    storePendingJob({ id: job.id, title: job.title, company: job.company, description: job.description });
    setOpeningId(job.id);
    startNavigation(() => router.push("/dashboard/analyze"));
  }

  async function recordApplication(job: JobPosting) {
    const result = await createSubmission({ jobId: job.id });
    if (result.ok) {
      setStatuses((prev) => ({ ...prev, [job.id]: result.data.submission.submission.status ?? prev[job.id] ?? "Applied" }));
      const text = result.data.created
        ? `Added "${job.title}" to your Spreadsheet.`
        : `"${job.title}" is already in your Spreadsheet.`;
      setNotice({ id: ++noticeCount.current, text });
    } else {
      setNotice({ id: ++noticeCount.current, text: `Couldn't add "${job.title}" to your Spreadsheet: ${result.error.message}`, error: true });
    }
  }

  if (state.status === "loading") return <BoardSkeleton />;

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-lg space-y-5 rounded-3xl border border-neutral-200 bg-white px-6 py-10 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
        <ErrorAlert>{state.message}</ErrorAlert>
        <Button
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search, plus one Filters menu (position type and how recently it was posted). They all combine. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[999_1_16rem]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, company, location or skill"
            aria-label="Search jobs"
            className="block w-full rounded-xl border border-neutral-200 bg-white py-2 pr-3.5 pl-10 text-sm text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
        </div>
        <FiltersMenu
          sections={[
            {
              name: "type",
              label: "Type",
              value: typeFilter,
              onChange: (v) => setTypeFilter(v as JobType | "All"),
              options: typeTabs.map((t) => ({ value: t.key, label: t.label, count: t.count })),
            },
            {
              name: "posted",
              label: "Posted",
              value: postedFilter,
              onChange: (v) => setPostedFilter(v as PostedRange),
              options: POSTED_RANGES.map((r, i) => ({ value: r.key, label: r.label, count: postedCounts[i] })),
            },
          ]}
          onClear={() => {
            setTypeFilter("All");
            setPostedFilter("any");
          }}
        />
        <p className="text-sm whitespace-nowrap text-neutral-500 dark:text-neutral-400" aria-live="polite">
          {filtered.length === jobs.length ? `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}` : `${filtered.length} of ${jobs.length} jobs`}
        </p>
      </div>

      {jobs.some((job) => job.source === "mock") && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Jobs marked <span className="font-semibold">Demo</span> are sample listings for trying the app, not real
          openings.
        </p>
      )}

      {jobs.length === 0 ? (
        <EmptyBoard title="No jobs yet" body="New postings will show up here. Check back soon." />
      ) : filtered.length === 0 ? (
        <EmptyBoard
          title="No matching jobs"
          body={
            query.trim()
              ? `Nothing matches "${query.trim()}"${typeFilter === "All" ? "" : ` in ${JOB_TYPE_LABEL[typeFilter]}`}. Try a different search.`
              : postedFilter !== "any"
                ? `No ${typeFilter === "All" ? "" : `${JOB_TYPE_LABEL[typeFilter]} `}positions posted in the ${POSTED_RANGES.find((r) => r.key === postedFilter)?.label.toLowerCase()}. Try a longer time range.`
                : `No ${JOB_TYPE_LABEL[typeFilter as JobType]} positions right now. Try another type.`
          }
        />
      ) : (
        <>
          {/* What the row colors mean (applied jobs only). */}
          <ul aria-label="Application colors" className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-neutral-600 dark:text-neutral-300">
            {STAGES.filter((s) => s.stage !== "withdrawn").map((s) => (
              <li key={s.stage} className="inline-flex items-center gap-1.5" title={s.hint}>
                <span className={`size-2.5 rounded-sm ${STAGE_TONE[s.stage].dot}`} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
        <div className="mb-20 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          {/* Column headings (md and up); the rows use the same grid. */}
          <div
            aria-hidden="true"
            className={`hidden items-center gap-x-4 border-b border-neutral-200/80 bg-neutral-50 px-4 py-2 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase md:grid dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 ${ROW_COLUMNS}`}
          >
            <span className="pl-11">Role</span>
            <span>Location</span>
            <span>Posted</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
            <span />
          </div>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filtered.map((job) => (
              <li key={job.id}>
                <JobCard
                  job={job}
                  pitch={pitches[job.id] ?? ""}
                  onPitchSaved={(text) =>
                    setPitches((prev) => {
                      const next = { ...prev };
                      if (text) next[job.id] = text;
                      else delete next[job.id];
                      return next;
                    })
                  }
                  onTailor={() => tailorFor(job)}
                  onApply={() => void recordApplication(job)}
                  status={job.id in statuses ? statuses[job.id] : null}
                  opening={navigating && openingId === job.id}
                  disabled={navigating}
                />
              </li>
            ))}
          </ul>
        </div>
        </>
      )}

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-16 z-50 flex justify-center lg:left-72">
        {notice && (
          <p
            className={`pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
              notice.error
                ? "bg-rose-600 text-white"
                : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            }`}
          >
            {notice.text}
          </p>
        )}
      </div>
    </div>
  );
}

type FilterSection = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The first option is the "no filter" choice. */
  options: { value: string; label: string; count: number }[];
};

/** One "Filters" button that opens a small menu with a section per filter, each option with its job count. */
function FiltersMenu({ sections, onClear }: { sections: FilterSection[]; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  // What's switched on, for the button: "C2C · Last 24 hours".
  const active = sections.filter((s) => s.value !== s.options[0]?.value).map((s) => s.options.find((o) => o.value === s.value)?.label ?? s.value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
        className={`inline-flex max-w-[16rem] items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition focus-visible:ring-4 focus-visible:ring-brand-500/20 focus-visible:outline-none ${
          active.length
            ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300"
            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        }`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0" aria-hidden="true">
          <path d="M3 4.75A.75.75 0 0 1 3.75 4h12.5a.75.75 0 0 1 .53 1.28L12 10.06v4.19a.75.75 0 0 1-.4.66l-2.5 1.33A.75.75 0 0 1 8 15.58v-5.52L3.22 5.28A.75.75 0 0 1 3 4.75Z" />
        </svg>
        <span className="truncate">{active.length ? active.join(" · ") : "Filters"}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className={`size-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-neutral-200/80 bg-white p-2 shadow-xl shadow-neutral-900/10 dark:border-neutral-800 dark:bg-neutral-950"
        >
          {sections.map((section) => (
            <fieldset key={section.name} className="px-1 py-1.5 [&+&]:border-t [&+&]:border-neutral-100 dark:[&+&]:border-neutral-800">
              <legend className="px-2 pt-1 pb-1 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">{section.label}</legend>
              {section.options.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 has-[:checked]:font-semibold has-[:checked]:text-neutral-900 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/40 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:has-[:checked]:text-white"
                >
                  <input
                    type="radio"
                    name={`job-filter-${section.name}`}
                    value={option.value}
                    checked={section.value === option.value}
                    onChange={() => section.onChange(option.value)}
                    className="size-4 accent-brand-600 focus-visible:outline-none"
                  />
                  <span className="flex-1">{option.label}</span>
                  <span className="text-xs text-neutral-400 tabular-nums dark:text-neutral-500">
                    {option.count}
                    <span className="sr-only"> jobs</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
          {active.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyBoard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-neutral-300 px-6 py-14 text-center dark:border-neutral-700">
      <p className="font-semibold text-neutral-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{body}</p>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading jobs">
      <div className="h-11 w-full max-w-sm animate-pulse rounded-xl bg-neutral-200/70 dark:bg-neutral-800/60" />
      <div className="space-y-px overflow-hidden rounded-2xl">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 animate-pulse bg-neutral-200/60 dark:bg-neutral-800/60" />
        ))}
      </div>
    </div>
  );
}
