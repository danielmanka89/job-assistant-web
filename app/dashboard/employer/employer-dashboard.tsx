"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobPosting } from "@/lib/types";
import { listEmployerJobs, logout } from "@/lib/client/api";
import { useCurrentUser } from "@/lib/client/current-user";
import { NotEmployer } from "./not-employer";
import { JobPostForm } from "./job-post-form";
import { PostedJobs, type PostedState } from "./posted-jobs";

export function EmployerDashboard() {
  const user = useCurrentUser();
  // Set when the API refuses this account, which also covers sessions with no stored role.
  const [forbidden, setForbidden] = useState(false);
  const onForbidden = useCallback(() => setForbidden(true), []);

  if (user === undefined) {
    return <div className="h-96 animate-pulse rounded-3xl bg-neutral-200/60 dark:bg-neutral-800/60" aria-busy="true" />;
  }
  if (forbidden || user?.role === "SEEKER") return <NotEmployer />;
  return <EmployerWorkspace onForbidden={onForbidden} />;
}

function EmployerWorkspace({ onForbidden }: { onForbidden: () => void }) {
  const router = useRouter();
  const [posted, setPosted] = useState<PostedState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [justPostedId, setJustPostedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listEmployerJobs().then(async (result) => {
      if (!active) return;
      if (result.ok) {
        // Keep anything posted while this request was in flight.
        setPosted((prev) => {
          const fresh = prev.status === "ready" ? prev.jobs.filter((j) => !result.data.some((d) => d.id === j.id)) : [];
          return { status: "ready", jobs: [...fresh, ...result.data] };
        });
        return;
      }
      if (result.error.code === "UNAUTHORIZED" || result.error.code === "HTTP_401") {
        await logout();
        router.replace("/login");
        return;
      }
      if (result.error.code === "EMPLOYER_ONLY") {
        onForbidden();
        return;
      }
      setPosted({
        status: "error",
        message:
          result.error.code === "HTTP_404"
            ? "Your postings will show up here once the employer service is running."
            : result.error.message,
      });
    });
    return () => {
      active = false;
    };
  }, [attempt, router, onForbidden]);

  function onPosted(job: JobPosting) {
    setJustPostedId(job.id);
    setPosted((prev) => ({ status: "ready", jobs: [job, ...(prev.status === "ready" ? prev.jobs : [])] }));
  }

  return (
    <div className="space-y-10">
      <JobPostForm onPosted={onPosted} onForbidden={onForbidden} />
      <PostedJobs
        state={posted}
        highlightId={justPostedId}
        onRetry={() => {
          setPosted({ status: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    </div>
  );
}
