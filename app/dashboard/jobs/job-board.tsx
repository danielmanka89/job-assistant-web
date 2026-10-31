"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listJobs, logout } from "@/lib/client/api";
import type { JobPosting } from "@/lib/types";
import { storePendingJob } from "@/lib/client/jobs";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { JobCard } from "./job-card";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; jobs: JobPosting[] };

export function JobBoard() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");

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
    router.push("/dashboard/analyze");
  }

  if (state.status === "loading") return <BoardSkeleton />;

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, company, location or skill"
            aria-label="Search jobs"
            className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-10 text-[15px] text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
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
        <ul className="grid gap-5 md:grid-cols-2">
          {filtered.map((job) => (
            <li key={job.id} className="flex">
              <JobCard job={job} onTailor={() => tailorFor(job)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyBoard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
      <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading jobs">
      <div className="h-11 w-full max-w-sm animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
      <div className="grid gap-5 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
        ))}
      </div>
    </div>
  );
}
