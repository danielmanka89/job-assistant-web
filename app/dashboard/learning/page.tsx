import { Suspense } from "react";
import type { Metadata } from "next";
import { LearningView } from "./learning-view";

export const metadata: Metadata = { title: "Learning" };

export default function LearningPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">Learning</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Close your skill gaps and reach more employers. Each skill has a roadmap, lessons, certifications and
          practice.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" aria-hidden="true" />}>
        <LearningView />
      </Suspense>
    </main>
  );
}
