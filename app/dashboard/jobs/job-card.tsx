import type { JobPosting, JobSource } from "@/lib/types";
import { descriptionSnippet as snippet, safeApplyUrl } from "@/lib/client/jobs";

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
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 30) return `Posted ${days} days ago`;
  return `Posted ${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

export function JobCard({
  job,
  onTailor,
  opening = false,
  disabled = false,
}: {
  job: JobPosting;
  onTailor: () => void;
  /** This card's job is being opened on the job match page. */
  opening?: boolean;
  disabled?: boolean;
}) {
  const posted = postedLabel(job.createdAt);
  const applyUrl = safeApplyUrl(job.applyUrl);
  const badge = SOURCE_BADGES[job.source];
  const titleId = `job-${job.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className="flex w-full flex-col rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-brand-500/40"
    >
      <div className="flex items-start gap-4">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-2xl text-lg font-bold ${avatarColor(job.company)}`}
          aria-hidden="true"
        >
          {job.company.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg leading-snug font-semibold text-neutral-900 dark:text-white">
            {job.title}
          </h2>
          <p className="mt-0.5 text-[15px] font-medium text-neutral-600 dark:text-neutral-300">{job.company}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-500 dark:text-neutral-400">
        <span className="inline-flex items-center gap-1.5">
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 text-neutral-400" aria-hidden="true">
            <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
          </svg>
          <span className="sr-only">Location: </span>
          {job.location}
        </span>
        {badge && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
        )}
        {posted && <span className="text-xs">{posted}</span>}
      </div>

      <p className="mt-4 line-clamp-4 flex-1 text-[14px] leading-relaxed text-neutral-600 dark:text-neutral-400">
        {snippet(job.description)}
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onTailor}
          disabled={disabled || opening}
          aria-busy={opening || undefined}
          aria-describedby={titleId}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-4 py-3 font-display text-[15px] font-medium uppercase tracking-wider text-white shadow-sm shadow-brand-600/30 transition outline-none hover:bg-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          {opening ? (
            <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
              <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684Z" />
            </svg>
          )}
          {opening ? "Opening…" : "Tailor Resume for this Job"}
        </button>
        {applyUrl && (
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            Apply
            <span className="sr-only"> to {job.title} (opens in a new tab)</span>
          </a>
        )}
      </div>
    </article>
  );
}
