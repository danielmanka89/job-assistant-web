import type { Metadata } from "next";
import { Stepper } from "@/components/dashboard/stepper";
import { AnalyzeLoader } from "./analyze-loader";

export const metadata: Metadata = { title: "Match a job" };

export default function AnalyzePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Stepper current={2} />
      <div className="mt-10 mb-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
          Match your resume to a job
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Paste the job description. We&apos;ll show which of its keywords your resume already covers, which
          it&apos;s missing, and suggest clearer wording for your existing bullets. Nothing is added that you
          didn&apos;t write.
        </p>
      </div>
      <AnalyzeLoader />
    </main>
  );
}
