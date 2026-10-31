import Link from "next/link";

/** Shown to job seekers who open the employer dashboard. */
export function NotEmployer() {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-neutral-200 bg-white px-6 py-14 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-7" aria-hidden="true">
          <path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" strokeLinejoin="round" />
          <path d="M12 11v3m0 2.5v.01" strokeLinecap="round" />
        </svg>
      </span>
      <h2 className="mt-5 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">
        You need an employer account to view this
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        This page is for companies posting jobs. Your account is set up for job seekers, so head to the job board to
        find roles and tailor your resume to them.
      </p>
      <Link
        href="/dashboard/jobs"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 font-display text-[15px] font-medium tracking-wider text-white uppercase shadow-md shadow-brand-600/30 transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:hover:bg-brand-500"
      >
        Go to the job board
      </Link>
    </div>
  );
}
