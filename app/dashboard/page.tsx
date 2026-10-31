import type { Metadata } from "next";
import { Logo } from "@/components/brand";
import { LogoutButton } from "./logout-button";
import { ResumeDropzone } from "./resume-dropzone";

export const metadata: Metadata = { title: "Dashboard" };

const steps = [
  { label: "Upload resume", active: true },
  { label: "Paste job description", active: false },
  { label: "Review and download", active: false },
];

export default function DashboardPage() {
  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <ol className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {steps.map((step, i) => (
            <li key={step.label} className="flex items-center gap-3">
              <span
                className={`flex items-center gap-2 font-medium ${
                  step.active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                <span
                  className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${
                    step.active
                      ? "bg-indigo-600 text-white dark:bg-indigo-500"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {i + 1}
                </span>
                {step.label}
              </span>
              {i < steps.length - 1 && <span className="h-px w-6 bg-slate-300 dark:bg-slate-700" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Upload your resume
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
          We&apos;ll read your experience, education and skills so we can compare them against the jobs you&apos;re
          applying for.
        </p>

        <div className="mt-8">
          <ResumeDropzone />
        </div>
      </main>
    </div>
  );
}
