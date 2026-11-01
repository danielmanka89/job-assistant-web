import type { Metadata } from "next";
import { Stepper } from "@/components/dashboard/stepper";
import { ResumeDropzone } from "./resume-dropzone";

export const metadata: Metadata = { title: "Upload resume" };

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mb-10">
        <Stepper current={0} />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
        Upload your resume
      </h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        We&apos;ll read your experience, education and skills so we can compare them against the jobs you&apos;re
        applying for.
      </p>

      <div className="mt-8">
        <ResumeDropzone />
      </div>
    </main>
  );
}
