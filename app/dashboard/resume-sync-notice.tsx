"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

/** Shown once after the upload page saves a resume (?resume=synced&changes=N). */
export function ResumeSyncNotice() {
  const params = useSearchParams();
  const router = useRouter();
  if (params.get("resume") !== "synced") return null;
  const changes = Number(params.get("changes")) || 0;

  return (
    <div
      role="status"
      className="mb-8 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
    >
      <p className="flex items-start gap-3">
        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
        </svg>
        <span>
          <span className="font-semibold">Resume saved.</span>{" "}
          {changes > 0
            ? `Your profile was updated to match it (${changes} ${changes === 1 ? "change" : "changes"}).`
            : "Your profile already matched it."}
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-4 pl-7 sm:pl-0">
        <Link href="/dashboard/review" className="font-semibold underline underline-offset-2">
          Review resume
        </Link>
        <Link href="/dashboard/profile" className="font-semibold underline underline-offset-2">
          View profile
        </Link>
        <button
          type="button"
          onClick={() => router.replace("/dashboard", { scroll: false })}
          aria-label="Dismiss"
          className="grid size-7 place-items-center rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
