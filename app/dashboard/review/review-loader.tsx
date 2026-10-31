"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { USE_MOCK_API } from "@/lib/client/api";
import { sampleResume } from "@/lib/client/mock";
import { parseStoredResume, readStoredResumeRaw, subscribeToStoredResume } from "@/lib/client/resume-storage";
import { ResumeEditor } from "./resume-editor";

export function ReviewLoader() {
  // undefined while rendering on the server; null when nothing is stored in this tab.
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribeToStoredResume,
    readStoredResumeRaw,
    () => undefined,
  );

  const resume = useMemo(() => {
    if (raw === undefined) return undefined;
    return parseStoredResume(raw) ?? (USE_MOCK_API ? sampleResume() : null);
  }, [raw]);

  if (resume === undefined) return <LoadingState />;
  if (resume === null) return <EmptyState />;
  return <ResumeEditor key={resume.id} initial={resume} />;
}

function LoadingState() {
  return (
    <div className="space-y-6 lg:ml-[220px]" aria-busy="true" aria-label="Loading your resume">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-7" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
          <path d="M14 3v5h5M12 18v-6m0 0-2.5 2.5M12 12l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">No resume to review yet</h2>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
        Upload your resume first, and we&apos;ll bring you back here to check the details.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-500"
      >
        Upload a resume
      </Link>
    </div>
  );
}
