"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiError, LearningInsights } from "@/lib/types";
import { getLearningInsights, logout, startLearning } from "@/lib/client/api";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Gauge } from "@/components/ui/gauge";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: LearningInsights };

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

/** Right-hand column of My Profile: Market Reach from the resume and the skills that would raise it. */
export function MarketReachPanel() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  // Skills the user unticked; everything else listed is selected.
  const [unselected, setUnselected] = useState<ReadonlySet<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getLearningInsights().then(async (result) => {
      if (!live) return;
      if (!result.ok && isUnauthorized(result.error)) {
        await logout();
        router.replace("/login");
        return;
      }
      setLoad(result.ok ? { status: "ready", data: result.data } : { status: "error", message: result.error.message });
    });
    return () => {
      live = false;
    };
  }, [router]);

  if (load.status === "loading") {
    return <div className="h-[30rem] animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" aria-busy="true" aria-label="Loading Market Reach" />;
  }
  if (load.status === "error") return <ErrorAlert>{load.message}</ErrorAlert>;

  const { data } = load;
  if (!data.hasResume) return null; // the profile column already asks for a resume

  const selected = data.missingSkills.map((m) => m.skill).filter((s) => !unselected.has(s));
  const change = data.baselinePercent === null ? 0 : data.marketReachPercent - data.baselinePercent;

  async function viewLearningPath() {
    setError(null);
    if (!selected.length) {
      router.push("/dashboard/learning");
      return;
    }
    setStarting(true);
    const result = await startLearning(selected);
    if (!result.ok) {
      setStarting(false);
      if (isUnauthorized(result.error)) {
        await logout();
        router.replace("/login");
        return;
      }
      setError(result.error.message);
      return;
    }
    router.push(`/dashboard/learning?skill=${encodeURIComponent(selected[0])}`);
  }

  return (
    <section
      aria-labelledby="market-reach-title"
      className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <div className="bg-gradient-to-br from-brand-50 to-white px-6 pt-6 pb-5 dark:from-brand-500/10 dark:to-transparent">
        <h2 id="market-reach-title" className="text-xl font-semibold text-neutral-900 dark:text-white">
          Market Reach
        </h2>
        <div className="mt-4 flex items-center gap-5">
          <Gauge percent={data.marketReachPercent} />
          <div className="min-w-0 text-sm text-neutral-600 dark:text-neutral-300">
            <p>
              Your resume covers <span className="font-semibold text-neutral-900 dark:text-white">{data.marketReachPercent}%</span> of the
              skills employers are asking for.
            </p>
            {change !== 0 && (
              <p className={`mt-1 font-semibold ${change > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-500"}`}>
                {change > 0 ? "+" : ""}
                {change}% since your resume was uploaded
              </p>
            )}
          </div>
        </div>
        <p className="mt-4 text-[15px] font-medium text-neutral-800 dark:text-neutral-100">
          You can increase your reach to employers by learning new skills.
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Based on {data.jobsAnalyzed > 0 ? `${data.jobsAnalyzed} open ${data.jobsAnalyzed === 1 ? "job" : "jobs"} on the Job Board` : "general demand"} and
          the skills on your resume.
        </p>
      </div>

      <div className="px-6 py-5">
        {data.missingSkills.length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">Your resume already covers the most in-demand skills. Nice work.</p>
        ) : (
          <fieldset>
            <legend className="text-xs font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">In-demand skills you&apos;re missing</legend>
            <ul className="mt-3 space-y-2">
              {data.missingSkills.map((m) => {
                const checked = !unselected.has(m.skill);
                const id = `missing-${m.skill.replace(/\W+/g, "-")}`;
                return (
                  <li key={m.skill}>
                    <label
                      htmlFor={id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition ${
                        checked
                          ? "border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10"
                          : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
                      }`}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setUnselected((prev) => {
                            const next = new Set(prev);
                            if (next.has(m.skill)) next.delete(m.skill);
                            else next.add(m.skill);
                            return next;
                          })
                        }
                        className="mt-0.5 size-4 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-neutral-900 dark:text-white">Learn {m.skill}</span>
                          <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400">+{m.gainPercent}%</span>
                        </span>
                        <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                          {m.jobCount > 0 ? `Asked for in ${m.jobCount} of ${data.jobsAnalyzed} open jobs` : "In demand across the industry"}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {error && (
          <div className="mt-4">
            <ErrorAlert>{error}</ErrorAlert>
          </div>
        )}
        <Button type="button" onClick={viewLearningPath} loading={starting} className="mt-5 w-full">
          {selected.length ? "I'm interested · View learning path" : "View learning page"}
        </Button>
        {data.paths.length > 0 && (
          <Link
            href="/dashboard/learning"
            className="mt-3 block text-center text-sm font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
          >
            Continue your {data.paths.length} learning {data.paths.length === 1 ? "path" : "paths"}
          </Link>
        )}
      </div>
    </section>
  );
}
