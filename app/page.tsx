import Link from "next/link";
import { LandingCarousel } from "@/components/landing/landing-carousel";
import { WelcomeSlide } from "@/components/landing/welcome-slide";

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

/** Slide 2: the three steps, in the site's red and white. */
function HowItWorksSlide() {
  return (
    <div className="relative isolate flex size-full items-center overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-[#0c0c0c] dark:text-white">
      <div
        className="mono-grayscale pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55rem_40rem_at_15%_-5%,rgb(var(--brand-glow)/0.14),transparent),radial-gradient(40rem_30rem_at_95%_30%,rgb(var(--brand-glow)/0.08),transparent)] dark:bg-[radial-gradient(55rem_40rem_at_15%_-5%,rgb(var(--brand-glow)/0.32),transparent),radial-gradient(40rem_30rem_at_95%_30%,rgb(var(--brand-glow-deep)/0.3),transparent)]"
        aria-hidden="true"
      />
      {/* Side padding leaves room for the slider arrows (shown from tablet width up). */}
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 sm:px-24 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <span className="theme-on-dark inline-block rounded-md bg-neutral-900 px-3 py-1.5 font-display text-xs font-medium tracking-widest text-brand-500 uppercase sm:text-sm dark:bg-white/5">
            How it works
          </span>
          <h2 className="mt-4 text-4xl leading-[0.95] font-bold sm:text-6xl">
            <span className="block text-brand-600 dark:text-brand-500">Match the job.</span>
            <span className="block">Keep it true.</span>
          </h2>
          <ol className="mt-8 space-y-5 sm:mt-10 sm:space-y-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 border-l-2 border-brand-600 pl-4 sm:gap-5 sm:pl-5">
                <span className="font-display text-3xl leading-none font-bold text-brand-600/90 sm:text-4xl dark:text-brand-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-lg font-semibold uppercase sm:text-xl">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600 sm:text-base dark:text-neutral-400">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="hidden lg:block">
          <AnalysisPreview />
        </div>
      </div>
    </div>
  );
}

/** Slide 3: sign in (or create an account). */
function SignInSlide() {
  return (
    <div className="theme-on-dark relative isolate flex size-full items-center justify-center overflow-hidden bg-brand-600 px-6 py-16 text-center text-white sm:px-24">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45rem_30rem_at_50%_0%,rgba(255,255,255,0.18),transparent),radial-gradient(40rem_30rem_at_50%_110%,rgba(0,0,0,0.35),transparent)]"
        aria-hidden="true"
      />
      <div className="max-w-xl">
        <p className="font-display text-sm font-medium tracking-widest text-white/75 uppercase">JobAssistant Global</p>
        <h2 className="mt-4 text-4xl leading-[0.95] font-bold sm:text-6xl">Ready when you are.</h2>
        <p className="mt-5 text-base leading-relaxed text-white/85 sm:text-lg">
          Sign in to pick up where you left off: your profile, tailored resumes and every application in one place.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-9 py-4 font-display text-lg font-medium tracking-wider text-brand-600 uppercase shadow-xl shadow-black/20 transition hover:bg-white/90 focus-visible:ring-4 focus-visible:ring-white/50 focus-visible:outline-none sm:w-auto"
          >
            Sign In
            <ArrowIcon className="size-5" />
          </Link>
          <Link
            href="/register"
            className="inline-flex w-full items-center justify-center rounded-full border border-white/50 px-8 py-4 font-display text-lg font-medium tracking-wider text-white uppercase transition hover:bg-white/10 focus-visible:ring-4 focus-visible:ring-white/50 focus-visible:outline-none sm:w-auto"
          >
            Create an account
          </Link>
        </div>
        <Link href="/dashboard/jobs" className="mt-6 inline-block text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline">
          Or browse the job board
        </Link>
      </div>
    </div>
  );
}

/** The landing page: one full screen that never scrolls, with three slides side by side. */
export default function Home() {
  return (
    <main className="h-dvh w-screen overflow-hidden bg-neutral-950">
      <LandingCarousel
        slides={[
          { label: "Welcome", content: <WelcomeSlide /> },
          { label: "How it works", content: <HowItWorksSlide /> },
          { label: "Sign in", content: <SignInSlide /> },
        ]}
      />
    </main>
  );
}
