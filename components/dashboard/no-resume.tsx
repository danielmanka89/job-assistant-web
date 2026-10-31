import Link from "next/link";

/** Shown on flow steps that need a resume when none has been uploaded in this tab. */
export function NoResume({
  title,
  children,
  href = "/dashboard",
  action = "Upload a resume",
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-7" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
          <path d="M14 3v5h5M12 18v-6m0 0-2.5 2.5M12 12l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{children}</p>
      <Link
        href={href}
        className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-500"
      >
        {action}
      </Link>
    </div>
  );
}
