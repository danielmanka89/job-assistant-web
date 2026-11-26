import type { Metadata } from "next";
import { JdsView } from "./jds-view";

export const metadata: Metadata = { title: "My JDs" };

export default function JdsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">My JDs</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Job descriptions vendors send you directly, separate from the Job Board. Paste one and your resume is tailored to it, ready to
          download as PDF or Word and send back.
        </p>
      </div>
      <JdsView />
    </main>
  );
}
