"use client";

import { useState } from "react";
import type { Resume } from "@/lib/types";
import { NoResume } from "@/components/dashboard/no-resume";
import { readStoredAnalysis, readStoredTailoring } from "@/lib/client/analysis-storage";
import { useStoredResume } from "@/lib/client/use-stored-resume";
import { TailorView } from "./tailor-view";

export function DownloadLoader() {
  const resume = useStoredResume();

  if (resume === undefined) {
    return <div className="h-96 animate-pulse rounded-3xl bg-slate-200/60 dark:bg-slate-800/60" aria-busy="true" />;
  }
  if (resume === null) {
    return (
      <NoResume title="Upload a resume first">
        We need your resume and a job match before we can build a tailored version.
      </NoResume>
    );
  }
  return <WithTailoring key={resume.id} resume={resume} />;
}

function WithTailoring({ resume }: { resume: Resume }) {
  // Only mounts in the browser (the loader waits for storage), so reading sessionStorage here is safe.
  const [stored] = useState(() => {
    const tailoring = readStoredTailoring();
    if (!tailoring || tailoring.resumeId !== resume.id) return null;
    const analysis = readStoredAnalysis();
    return {
      response: tailoring.response,
      // Used only to highlight changed bullets; the preview still works without it.
      suggestions: analysis?.analysis.id === tailoring.gapAnalysisId ? analysis.analysis.suggestedBullets : [],
    };
  });

  if (!stored) {
    return (
      <NoResume title="Nothing to download yet" href="/dashboard/analyze" action="Go to job match">
        Run a job match, pick the bullet changes you want, and click Tailor Resume. Your files will appear here.
      </NoResume>
    );
  }
  return <TailorView original={resume} response={stored.response} suggestions={stored.suggestions} />;
}
