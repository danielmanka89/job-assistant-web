"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GapAnalysisResponse, Resume, SuggestedBullet } from "@/lib/types";
import { addSkills, analyzeGap, logout, tailorResume } from "@/lib/client/api";
import { readStoredAnalysis, storeAnalysis, storeTailoring } from "@/lib/client/analysis-storage";
import { clearPendingJob, readPendingJob } from "@/lib/client/jobs";
import { storeResume } from "@/lib/client/resume-storage";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { TextArea } from "@/components/ui/text-area";
import { AnalysisResults } from "./analysis-results";
import { SummaryOptimizer } from "./summary-optimizer";

const MIN_LENGTH = 50;
const MAX_LENGTH = 20000;

function validateJobDescription(value: string): string | undefined {
  const text = value.trim();
  if (!text) return "Paste a job description to analyze.";
  if (text.length < MIN_LENGTH) return `That looks too short. Paste the full job description (at least ${MIN_LENGTH} characters).`;
  if (text.length > MAX_LENGTH) return `Job descriptions can be at most ${MAX_LENGTH.toLocaleString()} characters. Remove anything that isn't about the role.`;
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

/**
 * A re-run gives the suggestions new ids, so keep the user's ticks on
 * suggestions that came back with the same wording.
 */
function carryOverAccepted(previous: SuggestedBullet[], accepted: string[], next: SuggestedBullet[]): string[] {
  const ticked = new Set(previous.filter((b) => accepted.includes(b.id)).map((b) => `${b.originalText}\n${b.text}`));
  return next.filter((b) => accepted.includes(b.id) || ticked.has(`${b.originalText}\n${b.text}`)).map((b) => b.id);
}

export function AnalyzeWorkspace({ resume }: { resume: Resume }) {
  const router = useRouter();
  // The workspace only mounts in the browser (the loader waits for storage), so reading it here is safe.
  // A job picked on the job board starts a fresh match with its description filled in.
  const [fromJob] = useState(readPendingJob);
  const [saved] = useState(() => {
    if (fromJob) return null;
    const stored = readStoredAnalysis();
    return stored && stored.resumeId === resume.id ? stored : null;
  });

  // Read once on mount above; clear it so a later visit doesn't prefill again.
  useEffect(() => clearPendingJob(), []);

  const [jobDescription, setJobDescription] = useState(fromJob?.description ?? saved?.jobDescription ?? "");
  const [analyzedText, setAnalyzedText] = useState(saved?.jobDescription ?? "");
  const [analysis, setAnalysis] = useState<GapAnalysisResponse | null>(saved?.analysis ?? null);
  const [accepted, setAccepted] = useState<string[]>(saved?.acceptedBulletIds ?? []);
  const [analyzing, setAnalyzing] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [addingSkills, setAddingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  // Skills were saved but the follow-up analysis failed, so these results no longer match the resume.
  const [needsRefresh, setNeedsRefresh] = useState(false);
  // The resume prop comes from storage once; keep the summary here so a saved one shows right away.
  const [resumeSummary, setResumeSummary] = useState(resume.summary);
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
    setSkillsError(null);
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
    setSelectedSkills([]);
    setNeedsRefresh(false);
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

  async function onAddSkills() {
    if (!analysis || selectedSkills.length === 0) return;
    setSkillsError(null);
    setTailorError(null);
    setAddingSkills(true);

    const saved = await addSkills(resume.id, selectedSkills);
    if (!saved.ok) {
      setAddingSkills(false);
      const { code, message, fieldErrors } = saved.error;
      if (code === "UNAUTHORIZED" || code === "HTTP_401") {
        await logout();
        router.replace("/login");
        return;
      }
      if (code === "RESUME_NOT_FOUND" || code === "HTTP_404") {
        setSkillsError("We couldn't find this resume on the server anymore. Please upload it again from the dashboard.");
        return;
      }
      setSkillsError(fieldErrors?.newSkills ?? Object.values(fieldErrors ?? {})[0] ?? message);
      return;
    }
    storeResume(saved.data);
    setResumeSummary(saved.data.summary);

    // The resume changed, so run the match again to get a score (and suggestions) for the new version.
    const rerun = await analyzeGap({ resumeId: resume.id, jobDescription: analyzedText });
    setAddingSkills(false);
    setSelectedSkills([]);
    if (!rerun.ok) {
      setNeedsRefresh(true);
      setSkillsError("Your skills were added, but we couldn't update the score. Click Analyze Again to refresh it.");
      return;
    }

    const kept = carryOverAccepted(analysis.suggestedBullets, accepted, rerun.data.suggestedBullets);
    setAnalysis(rerun.data);
    setAccepted(kept);
    setNeedsRefresh(false);
    storeAnalysis({ resumeId: resume.id, jobDescription: analyzedText, analysis: rerun.data, acceptedBulletIds: kept });
  }

  async function signOutExpired() {
    await logout();
    router.replace("/login");
  }

  function onSummarySaved(updated: Resume) {
    storeResume(updated);
    setResumeSummary(updated.summary);
  }

  function onSkillsChange(skills: string[]) {
    setSelectedSkills(skills);
    setSkillsError(null);
  }

  function onAcceptedChange(ids: string[]) {
    setAccepted(ids);
    setTailorError(null);
    if (analysis) {
      storeAnalysis({ resumeId: resume.id, jobDescription: analyzedText, analysis, acceptedBulletIds: ids });
    }
  }

  const length = jobDescription.length;
  const textChanged = analysis !== null && jobDescription.trim() !== analyzedText;
  const outdated = textChanged || needsRefresh;

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="jd-title"
        className="rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
      >
        <div className="flex items-start gap-4 border-b border-neutral-100 px-5 py-5 sm:px-8 dark:border-neutral-800">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
              <path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1m-9 0h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
              <path d="M4 12h16" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h2 id="jd-title" className="text-lg font-semibold text-neutral-900 dark:text-white">
              Job description
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              Comparing with <span className="font-medium text-neutral-700 dark:text-neutral-300">{resume.sourceFileName}</span>
            </p>
          </div>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-8">
          {fromJob && (
            <p className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
                <path fillRule="evenodd" d="M6 3.75A2.75 2.75 0 0 1 8.75 1h2.5A2.75 2.75 0 0 1 14 3.75v.443c.572.055 1.14.122 1.706.2C17.053 4.582 18 5.75 18 7.07v3.469c0 1.126-.694 2.191-1.83 2.54-1.952.599-4.024.921-6.17.921s-4.219-.322-6.17-.921C2.694 12.73 2 11.665 2 10.539V7.07c0-1.321.947-2.489 2.294-2.676A41.047 41.047 0 0 1 6 4.193V3.75Zm6.5 0v.325a41.622 41.622 0 0 0-5 0V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25ZM10 10a1 1 0 0 0-1 1v.01a1 1 0 0 0 1 1h.01a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1H10Z" clipRule="evenodd" />
                <path d="M3 15.055v-.684c.126.053.255.1.39.142 2.092.642 4.313.987 6.61.987 2.297 0 4.518-.345 6.61-.987.135-.041.264-.089.39-.142v.684c0 1.347-.985 2.53-2.363 2.686a41.454 41.454 0 0 1-9.274 0C3.985 17.585 3 16.402 3 15.055Z" />
              </svg>
              <span>
                Filled in from the job board:{" "}
                <span className="font-semibold">
                  {fromJob.title}
                  {fromJob.company && ` at ${fromJob.company}`}
                </span>
                . Click Analyze Match to see how your resume fits.
              </span>
            </p>
          )}
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
            disabled={analyzing || addingSkills}
          />
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
              {textChanged ? (
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  You&apos;ve changed the text since the last analysis. Analyze again to update the results.
                </span>
              ) : (
                <>
                  {length.toLocaleString()} / {MAX_LENGTH.toLocaleString()} characters
                </>
              )}
            </p>
            <Button type="button" loading={analyzing} disabled={tailoring || addingSkills} onClick={onAnalyze} className="min-w-44">
              {analyzing ? "Analyzing…" : analysis && !textChanged ? "Analyze Again" : "Analyze Match"}
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
            selectedSkills={selectedSkills}
            onSkillsChange={onSkillsChange}
            onAddSkills={onAddSkills}
            addingSkills={addingSkills}
            skillsError={skillsError}
            busy={analyzing}
            summarySection={
              <SummaryOptimizer
                // A new analysis starts the picker over.
                key={analysis.id}
                resumeId={resume.id}
                jobDescription={analyzedText}
                summary={resumeSummary}
                matchedCount={analysis.matchedKeywords.length}
                disabled={outdated || analyzing || tailoring || addingSkills}
                onSaved={onSummarySaved}
                onUnauthorized={signOutExpired}
              />
            }
          />
        </div>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Analyzing your match">
      <div className="h-36 animate-pulse rounded-3xl bg-neutral-200/60 dark:bg-neutral-800/60" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-44 animate-pulse rounded-3xl bg-neutral-200/60 dark:bg-neutral-800/60" />
        <div className="h-44 animate-pulse rounded-3xl bg-neutral-200/60 dark:bg-neutral-800/60" />
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-neutral-200/60 dark:bg-neutral-800/60" />
    </div>
  );
}
