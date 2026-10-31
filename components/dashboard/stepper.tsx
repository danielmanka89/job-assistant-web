const STEPS = ["Upload resume", "Review details", "Job description", "Download"];

/** Progress indicator for the tailoring flow. `current` is the zero-based active step. */
export function Stepper({ current }: { current: number }) {
  return (
    <>
      <CompactStepper current={current} />
      <FullStepper current={current} />
    </>
  );
}

/** Phones: one line plus a segmented bar, instead of four steps wrapping across rows. */
function CompactStepper({ current }: { current: number }) {
  return (
    <div className="sm:hidden">
      <p className="text-sm">
        <span className="font-medium text-neutral-500 dark:text-neutral-400">
          Step {current + 1} of {STEPS.length}
        </span>
        <span className="mx-1.5 text-neutral-300 dark:text-neutral-600" aria-hidden="true">
          ·
        </span>
        <span className="font-semibold text-brand-600 dark:text-brand-400">{STEPS[current]}</span>
      </p>
      <div className="mt-2.5 grid grid-cols-4 gap-1.5" aria-hidden="true">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`h-1.5 rounded-full ${
              i < current
                ? "bg-emerald-500"
                : i === current
                  ? "bg-brand-600 dark:bg-brand-500"
                  : "bg-neutral-200 dark:bg-neutral-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function FullStepper({ current }: { current: number }) {
  return (
    <ol className="hidden flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:flex" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
            <span
              className={`flex items-center gap-2 font-medium ${
                active
                  ? "text-brand-600 dark:text-brand-400"
                  : done
                    ? "text-neutral-700 dark:text-neutral-300"
                    : "text-neutral-400 dark:text-neutral-500"
              }`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-brand-600 text-white dark:bg-brand-500"
                    : done
                      ? "bg-emerald-500 text-white"
                      : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
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
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-neutral-300 dark:bg-neutral-700" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
