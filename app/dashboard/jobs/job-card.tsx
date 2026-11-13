"use client";

import { useId, useState } from "react";
import type { JobPosting, JobSource } from "@/lib/types";
import { safeApplyUrl } from "@/lib/client/jobs";
import { saveJobPitch } from "@/lib/client/api";
import { MAX_PITCH_WORDS, countWords, limitWords } from "@/lib/pitch";
import { stageOf, type ApplicationStage } from "@/lib/application-stage";


// One job on the Job Board, as a compact list row. Clicking the row opens its description and the
// "Why should I hire you?" answer (up to 300 words, saved per job).


const SOURCE_BADGES: Record<JobSource, { label: string; className: string }> = {
  native: { label: "Posted here", className: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" },
  adzuna: { label: "via Adzuna", className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300" },
  mock: { label: "Demo", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
};


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
  const tile = STATUS_TILE[stage ?? "new"];

  return (
    <article
      aria-labelledby={titleId}
      className={expanded ? "bg-neutral-50/70 dark:bg-neutral-900/70" : undefined}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Where the application stands, as an icon only (the words are in the tooltip and for screen readers). */}
        <span
          title={tile.label}
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${tile.box}`}
        >
          {tile.icon}
          <span className="sr-only">Status: {tile.label}.</span>
        </span>

        {/* The role. The heading wraps the button (a heading can't sit inside one); clicking opens the
            description and the "Why should I hire you?" answer. */}
        <h3 className="min-w-0 flex-1 font-sans text-sm tracking-normal">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            className="block w-full min-w-0 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none"
          >
            <span id={titleId} className="block truncate text-[15px] font-semibold text-neutral-900 dark:text-white">
              {job.title}
            </span>
            <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">
              {company}
              {badge && job.source !== "native" && <span className="text-neutral-400 dark:text-neutral-500"> · {badge.label}</span>}
              {" · "}
              <span className="sr-only">Location: </span>
              {job.location}
              {posted && (
                <>
                  {" · "}
                  <span className="sr-only">Posted </span>
                  {posted}
                </>
              )}
              {pitch && (
                <>
                  {" · "}
                  Pitch<span aria-hidden="true"> ✓</span>
                  <span className="sr-only"> written</span>
                </>
              )}
            </span>
          </button>
        </h3>

        <span className="w-px self-stretch bg-neutral-100 dark:bg-neutral-800" aria-hidden="true" />

        {/* Actions, stacked. */}
        <span className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onTailor}
            disabled={disabled || opening}
            aria-busy={opening || undefined}
            aria-describedby={titleId}
            className="group inline-flex items-center gap-2 rounded-lg py-0.5 pr-1 text-xs font-semibold text-brand-700 transition hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-brand-300"
          >
            <span className="grid size-6 place-items-center rounded-md bg-brand-50 transition group-hover:bg-brand-100 dark:bg-brand-500/15">
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
            </span>
            {opening ? "Opening…" : "Tailor"}
          </button>
          {applyUrl && (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onApply}
              className="group inline-flex items-center gap-2 rounded-lg py-0.5 pr-1 text-xs font-semibold text-neutral-700 transition hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-neutral-200 dark:hover:text-white"
            >
              <span className="grid size-6 place-items-center rounded-md bg-neutral-100 transition group-hover:bg-neutral-200 dark:bg-neutral-800 dark:group-hover:bg-neutral-700">
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-3" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v5.69a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0 0 1.5h5.69l-7.22 7.22a.75.75 0 0 0 0 1.06Z" clipRule="evenodd" />
                </svg>
              </span>
              {applied ? "Re-apply" : "Apply"}
              <span className="sr-only"> to {job.title} (opens in a new tab)</span>
            </a>
          )}
        </span>
      </div>

      {expanded && (
        <div id={detailsId} className="grid gap-4 border-t border-neutral-100 px-4 pt-3 pb-4 md:grid-cols-2 dark:border-neutral-800">
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

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", className: "size-[18px]", "aria-hidden": true } as const;

/**
 * The status tile on each job: an icon in a soft tint, never a word on screen. Wording is gentle
 * ("Closed", not "Rejected"): a long list of rejections shouldn't wear the candidate down, so those
 * jobs get a quiet grey archive tile instead of red. Colors differ in lightness too, not hue alone.
 */
const STATUS_TILE: Record<ApplicationStage | "new", { label: string; box: string; icon: React.ReactNode }> = {
  new: {
    label: "Not applied yet",
    box: "border-[1.5px] border-dashed border-neutral-300 text-neutral-400 dark:border-neutral-600 dark:text-neutral-500",
    icon: (
      <svg {...iconProps} strokeWidth="1.8">
        <rect x="3.5" y="7" width="17" height="12" rx="2" />
        <path d="M9 7V5.5h6V7" />
      </svg>
    ),
  },
  applied: {
    label: "Sent: you applied",
    box: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
    icon: (
      <svg {...iconProps} strokeWidth="2">
        <path d="M4 12 20 4l-6 16-3-7z" strokeLinejoin="round" />
      </svg>
    ),
  },
  review: {
    label: "Waiting: under review",
    box: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    icon: (
      <svg {...iconProps} strokeWidth="2">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" strokeLinecap="round" />
      </svg>
    ),
  },
  approved: {
    label: "Moving ahead: approved",
    box: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    icon: (
      <svg {...iconProps} strokeWidth="2.4">
        <path d="m5 12 4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  rejected: {
    label: "Closed",
    box: "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500",
    icon: (
      <svg {...iconProps} strokeWidth="2">
        <path d="M4 7h16v3H4zM6 10v8h12v-8M10 14h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  withdrawn: {
    label: "Closed: you withdrew",
    box: "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500",
    icon: (
      <svg {...iconProps} strokeWidth="2">
        <path d="M4 7h16v3H4zM6 10v8h12v-8M10 14h4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
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
