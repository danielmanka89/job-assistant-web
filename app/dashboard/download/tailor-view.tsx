"use client";

import Link from "next/link";
import type { GeneratedFile, Resume, SuggestedBullet, TailoredResumeResponse } from "@/lib/types";
import { ResumePreview } from "./resume-preview";

type Props = {
  original: Resume;
  response: TailoredResumeResponse;
  suggestions: SuggestedBullet[];
};

export function TailorView({ original, response, suggestions }: Props) {
  const { tailoredResume, files } = response;
  const acceptedIds = new Set(tailoredResume.acceptedBulletIds);
  const accepted = suggestions.filter((b) => acceptedIds.has(b.id));
  const changes = tailoredResume.acceptedBulletIds.length;
  // Results saved in this tab before the score existed don't have it.
  const finalPercent = typeof response.finalMatchPercent === "number" ? Math.round(response.finalMatchPercent) : null;

  return (
    <div className="space-y-8">
      {finalPercent !== null && <FinalScore percent={finalPercent} />}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <ResumePreview original={original} tailored={tailoredResume} accepted={accepted} />

        {/* First on phones so the downloads don't sit below the whole preview. */}
        <aside className="order-first space-y-4 lg:sticky lg:top-24 lg:order-none">
          <section className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Download</h2>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">Your files are ready.</p>
            <div className="mt-4 space-y-3">
              <DownloadButton file={files.find((f) => f.format === "docx")} format="docx" />
              <DownloadButton file={files.find((f) => f.format === "pdf")} format="pdf" />
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200/80 bg-white p-5 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="font-semibold text-neutral-900 dark:text-white">
              {changes === 0 ? "No bullet changes" : `${changes} ${changes === 1 ? "bullet" : "bullets"} updated`}
            </p>
            <p className="mt-1 text-neutral-500 dark:text-neutral-400">
              Everything else is as you wrote it. Skills that match the job are listed first.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/dashboard/analyze" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                Change selected bullets
              </Link>
              <Link href="/dashboard/review" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                Edit resume details
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function FinalScore({ percent }: { percent: number }) {
  return (
    <section aria-labelledby="final-score" className="flex flex-col items-start gap-3">
      <p
        id="final-score"
        className="inline-flex items-center gap-3 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 py-2.5 pr-6 pl-2.5 text-white shadow-lg shadow-emerald-700/25 ring-1 ring-white/10 sm:gap-4 sm:py-3 sm:pr-8 sm:pl-3"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/20 sm:size-12">
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 sm:size-6" aria-hidden="true">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
        </span>
        <span className="font-display text-xl font-medium tracking-wide uppercase sm:text-3xl">
          Final Tailored Match: <span className="font-semibold tabular-nums">{percent}%</span>
        </span>
      </p>
      <p className="max-w-2xl text-xs leading-relaxed text-neutral-500 sm:text-sm dark:text-neutral-400">
        This score is locked to the exact text of this downloaded file. Re-uploading it may slightly alter the score due to
        PDF text-extraction quirks.
      </p>
    </section>
  );
}

const FORMATS = {
  docx: {
    label: "Download as Word (.docx)",
    badge: "DOCX",
    hint: "Best for editing further",
    className:
      "bg-gradient-to-br from-sky-600 to-blue-700 shadow-blue-600/25 hover:from-sky-500 hover:to-blue-600 focus-visible:ring-blue-500/40",
  },
  pdf: {
    label: "Download as PDF",
    badge: "PDF",
    hint: "Best for sending to employers",
    className:
      "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-600/25 hover:from-rose-400 hover:to-red-500 focus-visible:ring-rose-500/40",
  },
} as const;

function DownloadButton({ file, format }: { file?: GeneratedFile; format: "docx" | "pdf" }) {
  const config = FORMATS[format];
  const content = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20 text-xs font-bold tracking-wide">
        {config.badge}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] font-semibold">{config.label}</span>
        <span className="block truncate text-xs text-white/80">{file ? file.fileName : "Not available"}</span>
      </span>
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0" aria-hidden="true">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
    </>
  );
  const base = "flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-white shadow-lg outline-none transition focus-visible:ring-4";

  if (!file) {
    return (
      <span aria-disabled="true" className={`${base} cursor-not-allowed bg-neutral-400 opacity-60 shadow-none dark:bg-neutral-700`}>
        {content}
      </span>
    );
  }
  return (
    <a href={file.downloadUrl} download={file.fileName} className={`${base} ${config.className}`} title={config.hint}>
      {content}
    </a>
  );
}
