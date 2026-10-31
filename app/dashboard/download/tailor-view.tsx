"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GeneratedFile, Resume, TailoredResumeResponse } from "@/lib/types";
import { logout, tailorResume, type ApiResult } from "@/lib/client/api";
import type { StoredAnalysis } from "@/lib/client/analysis-storage";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { ResumePreview } from "./resume-preview";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; data: TailoredResumeResponse };

// React runs effects twice in development. Sharing the in-flight request per
// selection means we only ask the server to generate the files once.
const inflight = new Map<string, Promise<ApiResult<TailoredResumeResponse>>>();

function requestTailoring(stored: StoredAnalysis, attempt: number) {
  const key = [stored.analysis.id, ...[...stored.acceptedBulletIds].sort(), attempt].join("|");
  let promise = inflight.get(key);
  if (!promise) {
    promise = tailorResume({
      resumeId: stored.resumeId,
      gapAnalysisId: stored.analysis.id,
      jobDescription: stored.jobDescription,
      acceptedBulletIds: stored.acceptedBulletIds,
      formats: ["docx", "pdf"],
    });
    inflight.set(key, promise);
    // Forget it once settled, so a later visit generates fresh files.
    void promise.finally(() => setTimeout(() => inflight.delete(key), 1000));
  }
  return promise;
}

export function TailorView({ resume, stored }: { resume: Resume; stored: StoredAnalysis }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    requestTailoring(stored, attempt).then(async (result) => {
      if (!active) return;
      if (result.ok) {
        setState({ status: "done", data: result.data });
        return;
      }
      const { code, message } = result.error;
      if (code === "UNAUTHORIZED" || code === "HTTP_401") {
        await logout();
        router.replace("/login");
        return;
      }
      setState({
        status: "error",
        message:
          code === "HTTP_404"
            ? "Resume generation isn't available yet. Please try again once the service is running."
            : message,
      });
    });
    return () => {
      active = false;
    };
  }, [stored, attempt, router]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  if (state.status === "loading") return <Generating />;

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <ErrorAlert>{state.message}</ErrorAlert>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={retry}>
            Try again
          </Button>
          <Link
            href="/dashboard/analyze"
            className="rounded-xl px-4 py-2.5 text-[15px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Back to job match
          </Link>
        </div>
      </div>
    );
  }

  const { tailoredResume, files } = state.data;
  const accepted = stored.analysis.suggestedBullets.filter((b) => stored.acceptedBulletIds.includes(b.id));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <ResumePreview original={resume} tailored={tailoredResume} accepted={accepted} />

      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Download</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Your files are ready.</p>
          <div className="mt-4 space-y-3">
            <DownloadButton file={files.find((f) => f.format === "docx")} format="docx" />
            <DownloadButton file={files.find((f) => f.format === "pdf")} format="pdf" />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <p className="font-semibold text-slate-900 dark:text-white">
            {accepted.length === 0
              ? "No bullet changes"
              : `${accepted.length} ${accepted.length === 1 ? "bullet" : "bullets"} updated`}
          </p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Everything else is exactly as you wrote it.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/dashboard/analyze" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Change selected bullets
            </Link>
            <Link href="/dashboard/review" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Edit resume details
            </Link>
          </div>
        </section>
      </aside>
    </div>
  );
}

const FORMATS = {
  docx: {
    label: "Download as Word (.docx)",
    badge: "DOCX",
    hint: "Best for editing further",
    className:
      "bg-gradient-to-br from-sky-600 to-blue-700 shadow-blue-600/25 hover:from-sky-500 hover:to-blue-600 focus-visible:ring-blue-500/40",
  },
  pdf: {
    label: "Download as PDF",
    badge: "PDF",
    hint: "Best for sending to employers",
    className:
      "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-600/25 hover:from-rose-400 hover:to-red-500 focus-visible:ring-rose-500/40",
  },
} as const;

function DownloadButton({ file, format }: { file?: GeneratedFile; format: "docx" | "pdf" }) {
  const config = FORMATS[format];
  const content = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20 text-xs font-bold tracking-wide">
        {config.badge}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] font-semibold">{config.label}</span>
        <span className="block truncate text-xs text-white/80">{file ? file.fileName : "Not available"}</span>
      </span>
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0" aria-hidden="true">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
    </>
  );
  const base = "flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-white shadow-lg outline-none transition focus-visible:ring-4";

  if (!file) {
    return (
      <span aria-disabled="true" className={`${base} cursor-not-allowed bg-slate-400 opacity-60 shadow-none dark:bg-slate-700`}>
        {content}
      </span>
    );
  }
  return (
    <a href={file.downloadUrl} download={file.fileName} className={`${base} ${config.className}`} title={config.hint}>
      {content}
    </a>
  );
}

const GENERATING_STEPS = ["Applying your selected bullets…", "Formatting your resume…", "Creating Word and PDF files…"];

function Generating() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, GENERATING_STEPS.length - 1)), 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-8 py-16 shadow-sm sm:px-14 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mx-auto max-w-sm text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <svg className="size-7 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
          <p className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">Building your tailored resume</p>
          <p className="mt-1 text-sm font-medium text-indigo-600 dark:text-indigo-400" aria-hidden="true">
            {GENERATING_STEPS[step]}
          </p>
          <span className="sr-only" role="status">
            Building your tailored resume. This can take a few seconds.
          </span>
          <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-500/15">
            <div className="absolute inset-y-0 left-0 w-2/5 animate-indeterminate rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 motion-reduce:w-full motion-reduce:animate-pulse" />
          </div>
        </div>
        <div className="mt-12 space-y-3" aria-hidden="true">
          {[90, 75, 82, 60, 70].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      <div className="space-y-3" aria-hidden="true">
        <div className="h-[76px] animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
        <div className="h-[76px] animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
      </div>
    </div>
  );
}
