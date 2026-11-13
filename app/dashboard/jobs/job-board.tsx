"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSubmission, listJobPitches, listJobs, listSubmissions, logout } from "@/lib/client/api";
import type { JobPosting } from "@/lib/types";
import { storePendingJob } from "@/lib/client/jobs";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { JobCard, ROW_COLUMNS } from "./job-card";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; jobs: JobPosting[] };

export function JobBoard() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [navigating, startNavigation] = useTransition();
  // Jobs with a row in the Spreadsheet, and the message about the latest Apply click.
  const [appliedIds, setAppliedIds] = useState<ReadonlySet<string>>(new Set());
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
    // Only marks jobs as applied; the board works without it.
    listSubmissions().then((result) => {
      if (!active || !result.ok) return;
      const ids = result.data.map((s) => s.jobId).filter((id): id is string => id !== null);
      setAppliedIds((prev) => new Set([...prev, ...ids]));
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
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) =>
      [job.title, job.company, job.location, job.description].some((field) => field?.toLowerCase().includes(q)),
    );
  }, [jobs, query]);

  function tailorFor(job: JobPosting) {
    storePendingJob({ id: job.id, title: job.title, company: job.company, description: job.description });
    setOpeningId(job.id);
    startNavigation(() => router.push("/dashboard/analyze"));
  }

  async function recordApplication(job: JobPosting) {
    const result = await createSubmission({ jobId: job.id });
    if (result.ok) {
      setAppliedIds((prev) => new Set(prev).add(job.id));
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, company, location or skill"
            aria-label="Search jobs"
            className="block w-full rounded-xl border border-neutral-200 bg-white py-2.5 pr-3.5 pl-10 text-[15px] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
          {filtered.length === jobs.length
            ? `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}`
            : `${filtered.length} of ${jobs.length} jobs`}
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
        <EmptyBoard title="No matching jobs" body={`Nothing matches "${query.trim()}". Try a different search.`} />
      ) : (
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
                  applied={appliedIds.has(job.id)}
                  opening={navigating && openingId === job.id}
                  disabled={navigating}
                />
              </li>
            ))}
          </ul>
        </div>
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
