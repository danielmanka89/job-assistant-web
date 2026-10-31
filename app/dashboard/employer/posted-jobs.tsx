"use client";

import type { JobPosting } from "@/lib/types";
import { descriptionSnippet, safeApplyUrl } from "@/lib/client/jobs";
import { Button } from "@/components/ui/button";

export type PostedState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; jobs: JobPosting[] };

function postedOn(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function PostedJobs({
  state,
  highlightId,
  onRetry,
}: {
  state: PostedState;
  highlightId: string | null;
  onRetry: () => void;
}) {
  const count = state.status === "ready" ? state.jobs.length : null;

  return (
    <section aria-labelledby="posted-title">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="posted-title" className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
          Your postings
        </h2>
        {count !== null && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {count} {count === 1 ? "job" : "jobs"}
          </p>
        )}
      </div>

      {state.status === "loading" && (
        <ul className="space-y-3" aria-busy="true" aria-label="Loading your postings">
          {[0, 1].map((i) => (
            <li key={i} className="h-28 animate-pulse rounded-2xl bg-neutral-200/60 dark:bg-neutral-800/60" />
          ))}
        </ul>
      )}

      {state.status === "error" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-neutral-300 px-5 py-6 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-700">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{state.message}</p>
          <Button type="button" variant="secondary" onClick={onRetry} className="shrink-0">
            Try again
          </Button>
        </div>
      )}

      {state.status === "ready" && state.jobs.length === 0 && (
        <p className="rounded-2xl border border-dashed border-neutral-300 px-5 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          You haven&apos;t posted any jobs yet. Jobs you post above will appear here.
        </p>
      )}

      {state.status === "ready" && state.jobs.length > 0 && (
        <ul className="space-y-3">
          {state.jobs.map((job) => {
            const applyUrl = safeApplyUrl(job.applyUrl);
            const isNew = job.id === highlightId;
            return (
              <li
                key={job.id}
                className={`rounded-2xl border bg-white px-5 py-4 shadow-sm transition sm:px-6 dark:bg-neutral-900/60 ${
                  isNew
                    ? "border-brand-300 ring-4 ring-brand-500/10 dark:border-brand-500/50"
                    : "border-neutral-200/80 dark:border-neutral-800"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{job.title}</h3>
                      {isNew ? (
                        <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">New</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          Live
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-300">
                      {job.company} · {job.location}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                      {descriptionSnippet(job.description, 200)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-sm sm:flex-col sm:items-end sm:gap-1.5">
                    <span className="text-neutral-500 dark:text-neutral-400">Posted {postedOn(job.createdAt)}</span>
                    {applyUrl && (
                      <a
                        href={applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
                      >
                        Apply link
                        <span className="sr-only"> for {job.title} (opens in a new tab)</span>
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
