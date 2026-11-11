"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMockCallPrep, logout, writeMockCallPrep } from "@/lib/client/api";
import { PREP_CATEGORIES, type ApiError, type MockCallPrepResponse, type PrepCategory } from "@/lib/types";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

const CATEGORY_LABEL: Record<PrepCategory, string> = {
  summary: "About You",
  job: "Job Description",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
};
// The order the questions are shown in, the way a call usually goes.
const CATEGORY_ORDER: readonly PrepCategory[] = ["summary", "job", "experience", "projects", "skills"];

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: MockCallPrepResponse };

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

/** Mock call preparation for one submission: 50 questions with answers written from the job description and the resume. */
export function MockCallPrep({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobDescriptionError, setJobDescriptionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PrepCategory | "all">("all");
  const [practice, setPractice] = useState(false); // answers hidden until each is opened

  const signOut = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    let live = true;
    getMockCallPrep(submissionId).then((result) => {
      if (!live) return;
      if (!result.ok) {
        if (isUnauthorized(result.error)) return void signOut();
        setLoad({ status: "error", message: result.error.message });
        return;
      }
      setLoad({ status: "ready", data: result.data });
    });
    return () => {
      live = false;
    };
  }, [submissionId, signOut]);

  async function write() {
    setWriting(true);
    setWriteError(null);
    setJobDescriptionError(null);
    const result = await writeMockCallPrep(submissionId, jobDescription.trim() ? { jobDescription: jobDescription.trim() } : {});
    setWriting(false);
    if (!result.ok) {
      if (isUnauthorized(result.error)) return void signOut();
      const fieldError = result.error.fieldErrors?.jobDescription;
      if (fieldError) setJobDescriptionError(fieldError);
      else setWriteError(result.error.message);
      return;
    }
    setLoad({ status: "ready", data: result.data });
  }

  const data = load.status === "ready" ? load.data : null;
  const questions = data?.prep?.questions;
  // Numbered 1-50 in call order, so a question keeps its number when the list is filtered.
  const numbered = useMemo(() => {
    const valid = (questions ?? []).filter((q) => PREP_CATEGORIES.includes(q.category));
    return CATEGORY_ORDER.flatMap((c) => valid.filter((q) => q.category === c)).map((q, i) => ({ ...q, number: i + 1 }));
  }, [questions]);
  const shown = filter === "all" ? numbered : numbered.filter((q) => q.category === filter);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/spreadsheet" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Spreadsheet
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">Mock Call Prep</h1>
        {data && (
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{data.job.title}</span>
            {data.job.company && <> at {data.job.company}</>}. 50 questions an interviewer is likely to ask, with answers written from the job
            description and your resume.
          </p>
        )}
      </div>

      {load.status === "loading" && <div className="h-64 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" aria-hidden="true" />}
      {load.status === "error" && <ErrorAlert>{load.message}</ErrorAlert>}

      {data && !data.hasResume && (
        <Card>
          <p className="font-semibold text-neutral-900 dark:text-white">Upload your resume first</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Your answers are written from your resume, so there needs to be one on your profile.</p>
          <Link href="/dashboard/profile" className="mt-4 inline-block text-sm font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
            Go to My Profile
          </Link>
        </Card>
      )}

      {data && data.hasResume && writing && (
        <Card>
          <div role="status" className="flex items-start gap-4">
            <span className="mt-1 size-5 shrink-0 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" aria-hidden="true" />
            <div>
              <p className="font-semibold text-neutral-900 dark:text-white">Writing your 50 questions and answers…</p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                This usually takes two to three minutes. Keep this page open; they&apos;re saved when they&apos;re ready.
              </p>
            </div>
          </div>
        </Card>
      )}

      {data && data.hasResume && !writing && !data.prep && (
        <Card>
          <p className="font-semibold text-neutral-900 dark:text-white">Get ready for this call</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            You&apos;ll get 50 questions covering the job description, your experience, your projects, your skills and your summary, each with
            an answer in your own voice that only uses what&apos;s on your resume.
          </p>
          {!data.hasJobDescription && (
            <div className="mt-5">
              <label htmlFor="prep-jd" className="block text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                Job description
              </label>
              <p id="prep-jd-hint" className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                This row was added by hand, so paste the job description to prepare against.
              </p>
              <textarea
                id="prep-jd"
                rows={8}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                maxLength={20000}
                aria-describedby={jobDescriptionError ? "prep-jd-hint prep-jd-error" : "prep-jd-hint"}
                aria-invalid={Boolean(jobDescriptionError)}
                className="mt-2 block w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              {jobDescriptionError && (
                <p id="prep-jd-error" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                  {jobDescriptionError}
                </p>
              )}
            </div>
          )}
          {writeError && (
            <div className="mt-4">
              <ErrorAlert>{writeError}</ErrorAlert>
            </div>
          )}
          <Button type="button" onClick={write} className="mt-5">
            Prepare 50 Questions
          </Button>
        </Card>
      )}

      {data?.prep && !writing && (
        <>
          {writeError && <ErrorAlert>{writeError}</ErrorAlert>}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Written {dateFormat.format(new Date(data.prep.createdAt))}
              {!data.prep.upToDate && <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">Your resume has changed since.</span>}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
                <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} className="size-4 accent-brand-600" />
                Practice mode (hide answers)
              </label>
              <Button type="button" variant="secondary" onClick={write} className="px-4 py-2 text-sm">
                Write Again
              </Button>
            </div>
          </div>

          <div role="group" aria-label="Filter questions" className="flex flex-wrap gap-2">
            <FilterChip selected={filter === "all"} onClick={() => setFilter("all")} label="All" count={numbered.length} />
            {CATEGORY_ORDER.map((c) => (
              <FilterChip key={c} selected={filter === c} onClick={() => setFilter(c)} label={CATEGORY_LABEL[c]} count={numbered.filter((q) => q.category === c).length} />
            ))}
          </div>

          <ol className="space-y-3">
            {shown.map((q) => (
              <li key={q.number} className="rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex items-start gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 font-display text-sm font-semibold text-brand-700 tabular-nums dark:bg-brand-500/15 dark:text-brand-300">
                    {q.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">{CATEGORY_LABEL[q.category]}</p>
                    <p className="mt-1 font-semibold text-neutral-900 dark:text-white">{q.question}</p>
                    {practice ? (
                      // Remounted when practice mode is switched, so every answer starts closed again.
                      <details className="group mt-3">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full text-sm font-semibold text-brand-700 outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 dark:text-brand-300 [&::-webkit-details-marker]:hidden">
                          <span className="group-open:hidden">Show answer</span>
                          <span className="hidden group-open:inline">Hide answer</span>
                        </summary>
                        <p className="mt-2 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">{q.answer}</p>
                      </details>
                    ) : (
                      <p className="mt-2 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300">{q.answer}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/60">{children}</section>;
}

function FilterChip({ selected, onClick, label, count }: { selected: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 ${
        selected
          ? "bg-brand-600 text-white shadow-md shadow-brand-600/25"
          : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:text-white"
      }`}
    >
      {label} <span className="opacity-70 tabular-nums">{count}</span>
    </button>
  );
}
