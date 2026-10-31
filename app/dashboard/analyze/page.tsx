import type { Metadata } from "next";
import { AppHeader } from "@/components/dashboard/app-header";
import { Stepper } from "@/components/dashboard/stepper";
import { AnalyzeLoader } from "./analyze-loader";

export const metadata: Metadata = { title: "Match a job" };

export default function AnalyzePage() {
  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Stepper current={2} />
        <div className="mt-10 mb-10 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Match your resume to a job
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
            Paste the job description. We&apos;ll show which of its keywords your resume already covers, which
            it&apos;s missing, and suggest clearer wording for your existing bullets. Nothing is added that you
            didn&apos;t write.
          </p>
        </div>
        <AnalyzeLoader />
      </main>
    </div>
  );
}
