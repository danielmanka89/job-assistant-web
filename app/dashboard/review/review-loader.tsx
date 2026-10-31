"use client";

import { NoResume } from "@/components/dashboard/no-resume";
import { useStoredResume } from "@/lib/client/use-stored-resume";
import { ResumeEditor } from "./resume-editor";

export function ReviewLoader() {
  const resume = useStoredResume();

  if (resume === undefined) return <LoadingState />;
  if (resume === null) {
    return (
      <NoResume title="No resume to review yet">
        Upload your resume first, and we&apos;ll bring you back here to check the details.
      </NoResume>
    );
  }
  return <ResumeEditor key={resume.id} initial={resume} />;
}

function LoadingState() {
  return (
    <div className="space-y-6 lg:ml-[220px]" aria-busy="true" aria-label="Loading your resume">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-3xl bg-neutral-200/60 dark:bg-neutral-800/60" />
      ))}
    </div>
  );
}
