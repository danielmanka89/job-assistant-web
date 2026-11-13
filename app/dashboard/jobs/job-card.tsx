"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { JobPosting, JobSource } from "@/lib/types";
import { safeApplyUrl } from "@/lib/client/jobs";
import { saveJobPitch } from "@/lib/client/api";
import { MAX_PITCH_WORDS, countWords, limitWords } from "@/lib/pitch";
import { STAGES, stageOf, type ApplicationStage } from "@/lib/application-stage";

/** The table's columns from md up: Role · Location · Posted · Status · Actions · toggle. Shared with the header row. */
export const ROW_COLUMNS = "md:grid-cols-[minmax(0,1fr)_9rem_4.5rem_5.5rem_8.75rem_1.5rem]";

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
  status = null,
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
  /** The Status of this job's Spreadsheet row; null when you haven't applied. */
  status?: string | null;
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
  // Demo companies end in "(demo)"; the badge text says it once instead.
  const company = job.source === "mock" ? job.company.replace(/\s*\(demo\)\s*$/i, "") : job.company;

  const applied = status !== null;
  const stage = applied ? stageOf(status) : null;
  const tone = stage ? STAGE_TONE[stage] : null;

  return (
    <article
      aria-labelledby={titleId}
      // Applied jobs carry their stage's color: a bar on the left edge and a light tint.
      className={`border-l-4 ${tone ? `${tone.bar} ${tone.tint}` : "border-transparent"} ${
        expanded ? "bg-neutral-50/80 dark:bg-neutral-900/80" : tone ? "" : "transition hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50"
      }`}
    >
      <div className={`grid grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-x-4 gap-y-2 px-4 py-2.5 ${ROW_COLUMNS}`}>
        {/* Role: opens the description and the "Why should I hire you?" answer. The heading wraps the
            button (a heading can't sit inside one), so it still shows up in the page's list of headings. */}
        <h3 className="min-w-0 font-sans text-sm tracking-normal">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="flex w-full min-w-0 items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
        >
          <span className={`mono-grayscale grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${avatarColor(job.company)}`} aria-hidden="true">
            {job.company.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span id={titleId} className="block truncate text-sm font-semibold text-neutral-900 dark:text-white">
              {job.title}
            </span>
            <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
              {company}
              {badge && job.source !== "native" && <span className="text-neutral-400 dark:text-neutral-500"> · {badge.label}</span>}
              {/* On phones, where there are no Location and Posted columns. */}
              <span className="md:hidden">
                {" "}
                · {job.location}
                {posted ? ` · ${posted}` : ""}
              </span>
            </span>
          </span>
        </button>
        </h3>

        {/* Chevron: the same toggle for the mouse; the role button above is the keyboard one. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setExpanded((v) => !v)}
          className="grid size-6 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 md:order-last dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className={`size-4 transition ${expanded ? "rotate-180" : ""}`}>
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>

        <span className="hidden truncate text-xs text-neutral-600 md:block dark:text-neutral-300">
          <span className="sr-only">Location: </span>
          {job.location}
        </span>
        <span className="hidden text-xs text-neutral-500 tabular-nums md:block dark:text-neutral-400">
          {posted && <span className="sr-only">Posted </span>}
          {posted ?? "—"}
        </span>

        <span className="col-span-2 flex flex-wrap items-center gap-1 md:col-span-1">
          {stage && tone ? (
            <Link
              href="/dashboard/spreadsheet"
              title={`Spreadsheet status: ${status || "Applied"}. Change it in your Spreadsheet.`}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap hover:underline focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none ${tone.chip}`}
            >
              <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
              {STAGES.find((s) => s.stage === stage)?.label}
              <span className="sr-only">
                {" "}
                ({status || "Applied"}): view {job.title} in your Spreadsheet
              </span>
            </Link>
          ) : null}
          {pitch ? (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300" title="You've written why they should hire you">
              Pitch<span aria-hidden="true"> ✓</span>
              <span className="sr-only"> written</span>
            </span>
          ) : null}
          {!applied && !pitch && <span className="hidden text-xs text-neutral-400 md:inline dark:text-neutral-500">—</span>}
        </span>

        <span className="col-span-2 flex items-center gap-1.5 md:col-span-1 md:justify-end">
          <button
            type="button"
            onClick={onTailor}
            disabled={disabled || opening}
            aria-busy={opening || undefined}
            aria-describedby={titleId}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2.5 text-xs font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
          >
            {opening ? (
              <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-3" aria-hidden="true">
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
              className="inline-flex h-7 w-[4.5rem] items-center justify-center rounded-md border border-neutral-200 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {applied ? "Re-apply" : "Apply"}
              <span className="sr-only"> to {job.title} (opens in a new tab)</span>
            </a>
          )}
        </span>
      </div>

      {expanded && (
        <div id={detailsId} className="grid gap-4 px-4 pt-1 pb-4 md:grid-cols-2 md:pl-15">
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

/** Colors per stage. Kept apart in lightness as well as hue, and always paired with a text label. */
export const STAGE_TONE: Record<ApplicationStage, { bar: string; tint: string; chip: string; dot: string }> = {
  applied: {
    bar: "border-l-blue-500",
    tint: "bg-blue-50/60 dark:bg-blue-500/[0.07]",
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  review: {
    bar: "border-l-amber-400",
    tint: "bg-amber-50/70 dark:bg-amber-500/[0.07]",
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  approved: {
    bar: "border-l-emerald-500",
    tint: "bg-emerald-50/70 dark:bg-emerald-500/[0.07]",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  rejected: {
    bar: "border-l-red-500",
    tint: "bg-red-50/70 dark:bg-red-500/[0.07]",
    chip: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200",
    dot: "bg-red-500",
  },
  withdrawn: {
    bar: "border-l-neutral-400",
    tint: "bg-neutral-100/60 dark:bg-neutral-800/40",
    chip: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    dot: "bg-neutral-400",
  },
};

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
