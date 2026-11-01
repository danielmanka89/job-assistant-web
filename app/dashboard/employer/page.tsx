import type { Metadata } from "next";
import { EmployerDashboard } from "./employer-dashboard";

export const metadata: Metadata = { title: "Post a job" };

export default function EmployerPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
          Employer dashboard
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Post a job to the job board. Candidates can tailor their resume to it in one click, then apply through
          your link.
        </p>
      </div>
      <EmployerDashboard />
    </main>
  );
}
