import Link from "next/link";
import { Logo } from "@/components/brand";

const STEPS = [
  {
    title: "Upload your resume",
    body: "Drop in a PDF or Word file. We read it into editable sections you can check and fix.",
  },
  {
    title: "Paste a job",
    body: "Paste any job description, or pick one from the job board, to see matched and missing keywords.",
  },
  {
    title: "Pick and download",
    body: "Choose which reworded bullets to use. Nothing is added unless you select it. Download .docx or .pdf.",
  },
];

const MATCHED = ["React", "TypeScript", "REST APIs", "Docker"];
const MISSING = ["GraphQL", "Next.js", "A/B testing"];

function ArrowIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v5.69a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0 0 1.5h5.69l-7.22 7.22a.75.75 0 0 0 0 1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** A static preview of the gap analysis screen, built from markup rather than a screenshot. */
function AnalysisPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-brand-600/20 blur-3xl dark:bg-brand-600/25" aria-hidden="true" />
      <div className="relative rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl shadow-neutral-300/50 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/50">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Job match</p>
          <span className="font-display text-3xl font-semibold text-brand-600 dark:text-brand-500">57%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div className="h-full w-[57%] rounded-full bg-gradient-to-r from-brand-700 to-brand-500" />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">On your resume</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MATCHED.map((k) => (
            <span
              key={k}
              className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            >
              {k}
            </span>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Missing</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MISSING.map((k) => (
            <span
              key={k}
              className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
            >
              {k}
            </span>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-neutral-50 p-4 ring-1 ring-brand-600/40 dark:bg-neutral-950">
          <div className="flex gap-3">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-brand-600 text-white" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <div className="text-sm leading-relaxed">
              <p className="font-medium text-neutral-900 dark:text-white">
                Improved checkout conversion by rebuilding the checkout flow in React, cutting drop-off by 18%.
              </p>
              <p className="mt-2 text-neutral-500 dark:text-neutral-400">
                <span className="font-medium text-neutral-600 dark:text-neutral-300">Was: </span>
                Rebuilt the checkout flow in React, cutting drop-off by 18%.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-[#0c0c0c] dark:text-white">
      {/* Red glow behind the hero, stronger in dark mode. */}
      <div
        className="mono-grayscale pointer-events-none absolute inset-0 bg-[radial-gradient(55rem_40rem_at_15%_-5%,rgba(207,35,41,0.14),transparent),radial-gradient(40rem_30rem_at_95%_30%,rgba(207,35,41,0.08),transparent)] dark:bg-[radial-gradient(55rem_40rem_at_15%_-5%,rgba(207,35,41,0.32),transparent),radial-gradient(40rem_30rem_at_95%_30%,rgba(143,25,30,0.3),transparent)]"
        aria-hidden="true"
      />

      <header className="relative border-b border-neutral-200/80 dark:border-white/10">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 pr-16 pl-4 sm:pr-20 sm:pl-6 xl:pr-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            <a
              href="#how-it-works"
              className="rounded-full px-4 py-1.5 font-display text-[15px] font-medium uppercase tracking-wider text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            >
              How it works
            </a>
            <Link
              href="/dashboard/jobs"
              className="rounded-full px-4 py-1.5 font-display text-[15px] font-medium uppercase tracking-wider text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            >
              Job board
            </Link>
            <Link
              href="/login"
              className="rounded-full px-4 py-1.5 font-display text-[15px] font-medium uppercase tracking-wider text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            >
              Sign in
            </Link>
          </nav>
          <Link
            href="/register"
            className="group inline-flex items-center gap-1 rounded-full bg-brand-600 py-1 pl-5 pr-1 font-display text-[15px] font-medium uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 dark:hover:bg-brand-500"
          >
            Get started
            <span className="ml-2 grid size-9 place-items-center rounded-full bg-white/15 transition group-hover:bg-white/25">
              <ArrowIcon className="size-4" />
            </span>
          </Link>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:pb-28">
          <div>
            <span className="theme-on-dark inline-block rounded-md bg-neutral-900 px-3 py-1.5 font-display text-sm font-medium uppercase tracking-widest text-brand-500 dark:bg-white/5">
              Resume tailoring, nothing made up
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[0.95] sm:text-7xl lg:whitespace-nowrap lg:text-[5rem]">
              <span className="block text-brand-600 dark:text-brand-500">Match the job.</span>
              <span className="block">Keep it true.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
              Paste a job description, see which keywords you&apos;re missing, and pick the reworded bullets you like. Every
              change comes from your own experience. Then download it as .docx or .pdf.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center rounded-full bg-brand-600 px-7 py-3.5 font-display text-base font-medium uppercase tracking-wider text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 dark:hover:bg-brand-500"
              >
                Tailor my resume
              </Link>
              <Link
                href="/register"
                aria-label="Get started"
                className="grid size-[52px] place-items-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition hover:rotate-45 hover:bg-brand-700 dark:hover:bg-brand-500"
              >
                <ArrowIcon />
              </Link>
              <Link
                href="/login"
                className="ml-1 inline-flex items-center rounded-full border border-neutral-300 px-7 py-3.5 font-display text-base font-medium uppercase tracking-wider text-neutral-800 transition hover:border-neutral-400 hover:bg-white dark:border-white/20 dark:text-white dark:hover:border-white/40 dark:hover:bg-white/5"
              >
                Sign in
              </Link>
            </div>
          </div>

          <AnalysisPreview />
        </section>

        <section
          id="how-it-works"
          className="border-t border-neutral-200/80 bg-white/60 py-20 dark:border-white/10 dark:bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="font-display text-sm font-medium uppercase tracking-widest text-brand-600 dark:text-brand-500">
              How it works
            </p>
            <h2 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">Three steps to a sharper resume</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="border-t-2 border-brand-600 pt-6">
                  <span className="font-display text-6xl font-bold leading-none text-brand-600/90 dark:text-brand-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-2xl font-semibold uppercase">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-neutral-600 dark:text-neutral-400">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-neutral-200/80 py-8 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-neutral-500 sm:flex-row sm:px-6 dark:text-neutral-400">
          <span>Your experience, your words, matched to the role.</span>
          <Link href="/dashboard/jobs" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-500 dark:hover:text-brand-400">
            Browse the job board
          </Link>
        </div>
      </footer>
    </div>
  );
}
