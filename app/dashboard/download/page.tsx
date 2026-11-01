import type { Metadata } from "next";
import { Stepper } from "@/components/dashboard/stepper";
import { DownloadLoader } from "./download-loader";

export const metadata: Metadata = { title: "Download resume" };

export default function DownloadPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Stepper current={3} />
      <div className="mt-10 mb-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
          Your tailored resume
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Compare it with your original, then download it as a Word document or PDF.
        </p>
      </div>
      <DownloadLoader />
    </main>
  );
}
