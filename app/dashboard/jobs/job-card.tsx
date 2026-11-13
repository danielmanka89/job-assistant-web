"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { JobPosting, JobSource } from "@/lib/types";
import { safeApplyUrl } from "@/lib/client/jobs";
import { saveJobPitch } from "@/lib/client/api";
import { MAX_PITCH_WORDS, countWords, limitWords } from "@/lib/pitch";

// One job on the Job Board, as a compact list row. Clicking the row opens its description and the
// "Why should I hire you?" answer (up to 300 words, saved per job).

const AVATAR_COLORS = [
  "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
];

const SOURCE_BADGES: Record<JobSource, { label: string; className: string }> = {
  native: { label: "Posted here", className: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" },
  adzuna: { label: "via Adzuna", className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300" },
  mock: { label: "Demo", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
};

function avatarColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function postedLabel(iso?: string) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return null;
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function JobCard({
  job,
  pitch,
  onPitchSaved,
  onTailor,
  onApply,
  applied = false,
  opening = false,
  disabled = false,
}: {
  job: JobPosting;
  /** Your saved "Why should I hire you?" answer for this job ("" when none). */
  pitch: string;
  onPitchSaved: (text: string) => void;
  onTailor: () => void;
  /** Called when the Apply link is clicked; the link still opens the job's page in a new tab. */
  onApply: () => void;
  /** The job already has a row in the user's Spreadsheet. */
  applied?: boolean;
  /** This row's job is being opened on the job match page. */
  opening?: boolean;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const posted = postedLabel(job.createdAt);
  const applyUrl = safeApplyUrl(job.applyUrl);
  const badge = SOURCE_BADGES[job.source];
  const titleId = `job-${job.id}-title`;
  const detailsId = `job-${job.id}-details`;

  return (
    <article aria-labelledby={titleId} className={`transition ${expanded ? "bg-neutral-50/80 dark:bg-neutral-900/80" : "hover:bg-neutral-50 dark:hover:bg-neutral-900/50"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="flex min-w-0 flex-[999_1_18rem] items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
        >
          <span className={`mono-grayscale grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${avatarColor(job.company)}`} aria-hidden="true">
            {job.company.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1">
            <h3 id={titleId} className="truncate font-sans text-sm font-semibold tracking-normal text-neutral-900 dark:text-white">
              {job.title}
            </h3>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">{job.company}</span>
              <span aria-hidden="true">·</span>
              <span>
                <span className="sr-only">Location: </span>
                {job.location}
              </span>
              {posted && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    <span className="sr-only">Posted </span>
                    {posted}
                  </span>
                </>
              )}
            </span>
          </span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`size-4 shrink-0 text-neutral-400 transition ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="flex flex-[1_0_auto] items-center justify-end gap-1.5">
          {badge && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>}
          {pitch && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" title="You've written why they should hire you">
              Pitch ✓
            </span>
          )}
          {applied && (
            <Link
              href="/dashboard/spreadsheet"
              className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:underline dark:bg-emerald-500/15 dark:text-emerald-300"
            >
              Applied
              <span className="sr-only">: view {job.title} in your Spreadsheet</span>
            </Link>
          )}
          <button
            type="button"
            onClick={onTailor}
            disabled={disabled || opening}
            aria-busy={opening || undefined}
            aria-describedby={titleId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {opening ? (
              <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
                <path d="M6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684Z" />
              </svg>
            )}
            {opening ? "Opening…" : "Tailor"}
          </button>
          {applyUrl && (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onApply}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {applied ? "Apply again" : "Apply"}
              <span className="sr-only"> to {job.title} (opens in a new tab)</span>
            </a>
          )}
        </div>
      </div>

      {expanded && (
        <div id={detailsId} className="grid gap-4 px-4 pb-4 md:grid-cols-2 md:pl-16">
          <div>
            <h4 className="pb-1 text-xs font-bold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">Job description</h4>
            <p className="max-h-60 overflow-y-auto pr-1 text-[13px] leading-relaxed whitespace-pre-line text-neutral-600 dark:text-neutral-300">{job.description}</p>
          </div>
          <PitchEditor jobId={job.id} jobTitle={job.title} saved={pitch} onSaved={onPitchSaved} />
        </div>
      )}
    </article>
  );
}

/** "Why should I hire you?" for one job: up to 300 words, saved to your account. */
function PitchEditor({ jobId, jobTitle, saved, onSaved }: { jobId: string; jobTitle: string; saved: string; onSaved: (text: string) => void }) {
  const [text, setText] = useState(saved);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const fieldId = useId();
  const countId = useId();
  const words = countWords(text);
  const changed = text.trim() !== saved.trim();
  const atLimit = words >= MAX_PITCH_WORDS;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    const result = await saveJobPitch(jobId, text);
    if (!result.ok) return setStatus({ kind: "error", message: Object.values(result.error.fieldErrors ?? {})[0] ?? result.error.message });
    onSaved(text.trim());
    setStatus({ kind: "saved", message: text.trim() ? "Saved" : "Removed" });
  }

  return (
    <form onSubmit={save} className="flex flex-col">
      <label htmlFor={fieldId} className="pb-1 text-xs font-bold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
        Why should I hire you?
      </label>
      <textarea
        id={fieldId}
        value={text}
        onChange={(e) => {
          setText(limitWords(e.target.value));
          if (status.kind !== "saving") setStatus({ kind: "idle" });
        }}
        aria-describedby={countId}
        rows={6}
        placeholder={`In your own words, why you're a great fit for ${jobTitle}. Up to ${MAX_PITCH_WORDS} words.`}
        className="min-h-32 w-full flex-1 resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
      />
      <div className="mt-2 flex items-center gap-3">
        <p id={countId} className={`text-xs tabular-nums ${atLimit ? "font-semibold text-amber-700 dark:text-amber-300" : "text-neutral-500 dark:text-neutral-400"}`}>
          {words} / {MAX_PITCH_WORDS} words{atLimit ? " · limit reached" : ""}
        </p>
        <span role="status" className={`text-xs font-medium ${status.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
          {status.kind === "saved" || status.kind === "error" ? status.message : ""}
        </span>
        <button
          type="submit"
          disabled={!changed || status.kind === "saving"}
          className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none disabled:opacity-50"
        >
          {status.kind === "saving" ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
