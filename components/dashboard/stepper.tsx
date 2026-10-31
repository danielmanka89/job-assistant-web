const STEPS = ["Upload resume", "Review details", "Job description", "Download"];

/** Progress indicator for the tailoring flow. `current` is the zero-based active step. */
export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
            <span
              className={`flex items-center gap-2 font-medium ${
                active
                  ? "text-indigo-600 dark:text-indigo-400"
                  : done
                    ? "text-slate-700 dark:text-slate-300"
                    : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-indigo-600 text-white dark:bg-indigo-500"
                    : done
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-slate-300 dark:bg-slate-700" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
