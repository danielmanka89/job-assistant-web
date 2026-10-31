"use client";

import { useState } from "react";
import type { Resume } from "@/lib/types";
import { NoResume } from "@/components/dashboard/no-resume";
import { readStoredAnalysis } from "@/lib/client/analysis-storage";
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
  return <WithAnalysis key={resume.id} resume={resume} />;
}

function WithAnalysis({ resume }: { resume: Resume }) {
  // Only mounts in the browser (the loader waits for storage), so reading sessionStorage here is safe.
  const [stored] = useState(() => {
    const value = readStoredAnalysis();
    return value && value.resumeId === resume.id ? value : null;
  });

  if (!stored) {
    return (
      <NoResume title="Match a job first" href="/dashboard/analyze" action="Paste a job description">
        Run a job match and pick the bullet changes you want, then we&apos;ll build your tailored resume.
      </NoResume>
    );
  }
  return <TailorView resume={resume} stored={stored} />;
}
