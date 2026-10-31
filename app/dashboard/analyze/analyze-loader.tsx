"use client";

import { NoResume } from "@/components/dashboard/no-resume";
import { useStoredResume } from "@/lib/client/use-stored-resume";
import { AnalyzeWorkspace } from "./analyze-workspace";

export function AnalyzeLoader() {
  const resume = useStoredResume();

  if (resume === undefined) {
    return <div className="h-80 animate-pulse rounded-3xl bg-neutral-200/60 dark:bg-neutral-800/60" aria-busy="true" />;
  }
  if (resume === null) {
    return (
      <NoResume title="Upload a resume first">
        We need your resume to compare it with a job description.
      </NoResume>
    );
  }
  return <AnalyzeWorkspace key={resume.id} resume={resume} />;
}
