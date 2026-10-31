import type { Metadata } from "next";
import { AppHeader } from "@/components/dashboard/app-header";
import { Stepper } from "@/components/dashboard/stepper";
import { ReviewLoader } from "./review-loader";

export const metadata: Metadata = { title: "Review resume" };

export default function ReviewPage() {
  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Stepper current={1} />
        <div className="mt-10 mb-10 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
            Review your resume
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Check what we pulled from your file and fix anything that&apos;s off. These details are what we&apos;ll
            match against the jobs you apply for.
          </p>
        </div>
        <ReviewLoader />
      </main>
    </div>
  );
}
