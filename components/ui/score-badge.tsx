const CHECK_ICON =
  "M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z";
const ALERT_ICON =
  "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z";

/**
 * Color and icon for a final match score: green from 80%, amber from 50%, red below.
 * Darker shades than the analyze ring so white text stays readable on every color.
 */
export function scoreLevel(percent: number) {
  if (percent >= 80) {
    return { label: "Strong match", className: "from-emerald-600 to-emerald-700 shadow-emerald-700/25", icon: CHECK_ICON };
  }
  if (percent >= 50) {
    return { label: "Fair match", className: "from-amber-600 to-orange-700 shadow-orange-700/25", icon: ALERT_ICON };
  }
  return { label: "Weak match", className: "from-rose-600 to-red-700 shadow-red-700/25", icon: ALERT_ICON };
}

/** Compact pill version of the final score, for lists. Shows "No score" when the score is unknown. */
export function ScoreBadge({ percent }: { percent: number | null }) {
  if (percent === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        No score
      </span>
    );
  }
  const level = scoreLevel(percent);
  return (
    <span
      title={level.label}
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br py-1 pr-3 pl-1.5 text-white shadow-sm ${level.className}`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
        <path fillRule="evenodd" d={level.icon} clipRule="evenodd" />
      </svg>
      <span className="text-sm font-semibold tabular-nums">{percent}%</span>
      <span className="sr-only">match, {level.label.toLowerCase()}</span>
    </span>
  );
}
