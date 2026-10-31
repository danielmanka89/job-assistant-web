"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GapAnalysisResponse, Resume } from "@/lib/types";
import { analyzeGap, logout, tailorResume } from "@/lib/client/api";
import { readStoredAnalysis, storeAnalysis, storeTailoring } from "@/lib/client/analysis-storage";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { TextArea } from "@/components/ui/text-area";
import { AnalysisResults } from "./analysis-results";

const MIN_LENGTH = 50;
const MAX_LENGTH = 20000;

function validateJobDescription(value: string): string | undefined {
  const text = value.trim();
  if (!text) return "Paste a job description to analyze.";
  if (text.length < MIN_LENGTH) return `That looks too short. Paste the full job description (at least ${MIN_LENGTH} characters).`;
  return undefined;
}

/** Turns a failed POST /api/tailor into a message that says what to do next. */
function tailorErrorMessage(code: string, message: string, fieldErrors?: Record<string, string>): string {
  if (code === "RESUME_CHANGED") {
    return "You edited your resume after this analysis, so the suggestions may not fit anymore. Click Analyze Again to refresh them.";
  }
  if (code === "ANALYSIS_NOT_FOUND" || fieldErrors?.gapAnalysisId || fieldErrors?.acceptedBulletIds) {
    return "This job match is no longer available. Click Analyze Again to run it again.";
  }
  if (code === "RESUME_NOT_FOUND" || fieldErrors?.resumeId) {
    return "We couldn't find this resume on the server anymore. Please upload it again from the dashboard.";
  }
  if (code === "HTTP_404") return "Resume generation isn't available yet. Please try again once the service is running.";
  return message;
}

export function AnalyzeWorkspace({ resume }: { resume: Resume }) {
  const router = useRouter();
  // The workspace only mounts in the browser (the loader waits for storage), so reading it here is safe.
  const [saved] = useState(() => {
    const stored = readStoredAnalysis();
    return stored && stored.resumeId === resume.id ? stored : null;
  });

  const [jobDescription, setJobDescription] = useState(saved?.jobDescription ?? "");
  const [analyzedText, setAnalyzedText] = useState(saved?.jobDescription ?? "");
  const [analysis, setAnalysis] = useState<GapAnalysisResponse | null>(saved?.analysis ?? null);
  const [accepted, setAccepted] = useState<string[]>(saved?.acceptedBulletIds ?? []);
  const [analyzing, setAnalyzing] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [scrollToResults, setScrollToResults] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollToResults === 0) return;
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    resultsRef.current?.focus({ preventScroll: true });
  }, [scrollToResults]);

  async function onAnalyze() {
    setError(null);
    setTailorError(null);
    const problem = validateJobDescription(jobDescription);
    setFieldError(problem);
    if (problem) return;

    setAnalyzing(true);
    const text = jobDescription.trim();
    const result = await analyzeGap({ resumeId: resume.id, jobDescription: text });
    setAnalyzing(false);

    if (!result.ok) {
      const { code, message, fieldErrors } = result.error;
      if (code === "UNAUTHORIZED" || code === "HTTP_401") {
        await logout();
        router.replace("/login");
        return;
      }
      if (code === "RESUME_NOT_FOUND" || fieldErrors?.resumeId) {
        setError("We couldn't find this resume on the server anymore. Please upload it again from the dashboard.");
        return;
      }
      if (code === "HTTP_404") {
        setError("Job matching isn't available yet. Please try again once the analysis service is running.");
        return;
      }
      if (fieldErrors?.jobDescription) {
        setFieldError(fieldErrors.jobDescription);
        return;
      }
      setError(message);
      return;
    }

    setAnalysis(result.data);
    setAnalyzedText(text);
    setAccepted([]);
    storeAnalysis({ resumeId: resume.id, jobDescription: text, analysis: result.data, acceptedBulletIds: [] });
    setScrollToResults((n) => n + 1);
  }

  async function onTailor() {
    if (!analysis) return;
    setTailorError(null);
    setTailoring(true);
    const result = await tailorResume({
      resumeId: resume.id,
      gapAnalysisId: analysis.id,
      jobDescription: analyzedText,
      acceptedBulletIds: accepted,
      formats: ["docx", "pdf"],
    });

    if (!result.ok) {
      setTailoring(false);
      const { code, message, fieldErrors } = result.error;
      if (code === "UNAUTHORIZED" || code === "HTTP_401") {
        await logout();
        router.replace("/login");
        return;
      }
      setTailorError(tailorErrorMessage(code, message, fieldErrors));
      return;
    }

    storeTailoring({ resumeId: resume.id, gapAnalysisId: analysis.id, response: result.data });
    // Stay in the loading state until the download page takes over.
    router.push("/dashboard/download");
  }

  function onAcceptedChange(ids: string[]) {
    setAccepted(ids);
    setTailorError(null);
    if (analysis) {
      storeAnalysis({ resumeId: resume.id, jobDescription: analyzedText, analysis, acceptedBulletIds: ids });
    }
  }

  const length = jobDescription.length;
  const outdated = analysis !== null && jobDescription.trim() !== analyzedText;

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="jd-title"
        className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
      >
        <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-5 sm:px-8 dark:border-slate-800">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
              <path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1m-9 0h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
              <path d="M4 12h16" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h2 id="jd-title" className="text-lg font-semibold text-slate-900 dark:text-white">
              Job description
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Comparing with <span className="font-medium text-slate-700 dark:text-slate-300">{resume.sourceFileName}</span>
            </p>
          </div>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-8">
          {error && <ErrorAlert>{error}</ErrorAlert>}
          <TextArea
            label="Job description"
            hideLabel
            rows={14}
            maxLength={MAX_LENGTH}
            value={jobDescription}
            onChange={(e) => {
              setJobDescription(e.target.value);
              if (fieldError) setFieldError(undefined);
            }}
            placeholder={"Paste the full posting here: responsibilities, requirements, nice-to-haves…"}
            error={fieldError}
            disabled={analyzing}
          />
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
              {outdated ? (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  You&apos;ve changed the text since the last analysis. Analyze again to update the results.
                </span>
              ) : (
                <>
                  {length.toLocaleString()} / {MAX_LENGTH.toLocaleString()} characters
                </>
              )}
            </p>
            <Button type="button" loading={analyzing} disabled={tailoring} onClick={onAnalyze} className="min-w-44">
              {analyzing ? "Analyzing…" : analysis && !outdated ? "Analyze Again" : "Analyze Match"}
            </Button>
          </div>
        </div>
      </section>

      {analyzing && !analysis && <ResultsSkeleton />}

      {analysis && (
        <div
          ref={resultsRef}
          tabIndex={-1}
          className={`scroll-mt-24 outline-none transition-opacity ${analyzing ? "opacity-50" : ""}`}
          aria-busy={analyzing || undefined}
        >
          <AnalysisResults
            analysis={analysis}
            resume={resume}
            accepted={accepted}
            onAcceptedChange={onAcceptedChange}
            outdated={outdated}
            onTailor={onTailor}
            tailoring={tailoring}
            tailorError={tailorError}
          />
        </div>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Analyzing your match">
      <div className="h-36 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-44 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
        <div className="h-44 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" />
    </div>
  );
}
