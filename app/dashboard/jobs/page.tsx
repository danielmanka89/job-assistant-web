import type { Metadata } from "next";
import { AppHeader } from "@/components/dashboard/app-header";
import { JobBoard } from "./job-board";

export const metadata: Metadata = { title: "Job board" };

export default function JobsPage() {
  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">Job board</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Find a role you like and tailor your resume to it in one click. We&apos;ll bring the job description
            with you.
          </p>
        </div>
        <JobBoard />
      </main>
    </div>
  );
}
