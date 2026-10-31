"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Resume } from "@/lib/types";
import { logout, uploadResume } from "@/lib/client/api";
import { storeResume } from "@/lib/client/resume-storage";
import { Button } from "@/components/ui/button";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const ACCEPTED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_BYTES = 10 * 1024 * 1024;

type State =
  | { status: "idle" }
  | { status: "uploading"; file: File; progress: number }
  | { status: "success"; file: File; resume: Resume }
  | { status: "error"; message: string };

function checkFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const okType =
    ACCEPTED_MIME.includes(file.type) || ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!okType) return "Only PDF or DOCX files are supported.";
  if (file.size > MAX_BYTES) return "That file is over 10 MB. Try a smaller export.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumeDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });

  async function start(file: File) {
    const problem = checkFile(file);
    if (problem) {
      setState({ status: "error", message: problem });
      return;
    }

    setState({ status: "uploading", file, progress: 0 });
    const result = await uploadResume(file, (progress) =>
      setState((s) => (s.status === "uploading" ? { ...s, progress } : s)),
    );

    if (result.ok) {
      storeResume(result.data);
      setState({ status: "success", file, resume: result.data });
      return;
    }
    if (result.error.code === "UNAUTHORIZED" || result.error.code === "HTTP_401") {
      await logout();
      router.replace("/login");
      return;
    }
    setState({ status: "error", message: result.error.message });
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) setDragging(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (state.status === "uploading") return;
    const file = e.dataTransfer.files?.[0];
    if (file) void start(file);
  }

  function reset() {
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  if (state.status === "success") {
    return <UploadSuccess resume={state.resume} file={state.file} onReplace={reset} />;
  }

  const uploading = state.status === "uploading";

  return (
    <div>
      <div
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          "relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition sm:py-20",
          dragging
            ? "scale-[1.01] border-indigo-500 bg-indigo-50/80 dark:border-indigo-400 dark:bg-indigo-500/10"
            : state.status === "error"
              ? "border-rose-300 bg-white dark:border-rose-500/50 dark:bg-slate-900/50"
              : "border-slate-300 bg-white hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-indigo-500",
        ].join(" ")}
      >
        <div
          className={`grid size-16 place-items-center rounded-2xl transition ${
            dragging
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-8" aria-hidden="true">
            <path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {uploading ? (
          state.progress < 100 ? (
            <UploadProgress fileName={state.file.name} progress={state.progress} />
          ) : (
            <ReadingProgress fileName={state.file.name} />
          )
        ) : (
          <>
            <p className="mt-6 text-lg font-semibold text-slate-900 dark:text-white">
              {dragging ? "Drop it here" : "Drag and drop your resume"}
            </p>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">PDF or DOCX, up to 10 MB</p>
            <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
              <span className="h-px w-10 bg-slate-200 dark:bg-slate-700" />
              or
              <span className="h-px w-10 bg-slate-200 dark:bg-slate-700" />
            </div>
            <Button type="button" variant="secondary" className="mt-6" onClick={() => inputRef.current?.click()}>
              Browse files
            </Button>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={[...ACCEPTED_EXTENSIONS, ...ACCEPTED_MIME].join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void start(file);
          }}
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          {state.message}
        </p>
      )}
    </div>
  );
}

function UploadProgress({ fileName, progress }: { fileName: string; progress: number }) {
  return (
    <div className="mt-6 w-full max-w-sm" aria-live="polite">
      <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{fileName}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Uploading… {progress}%</p>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Upload progress"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

const READING_STEPS = [
  "Reading your resume…",
  "Finding your contact details…",
  "Pulling out your work history…",
  "Collecting education and skills…",
  "Almost done…",
];
const STEP_MS = 3500;

/** Shown after the file is sent while the server parses it. Parsing has no real progress, so the bar is indeterminate. */
function ReadingProgress({ fileName }: { fileName: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, READING_STEPS.length - 1));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-6 w-full max-w-sm">
      <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{fileName}</p>
      <p className="mt-1 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
        <svg className="size-4 animate-spin motion-reduce:hidden" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span>
          {READING_STEPS[step]}
        </span>
      </p>
      {/* Announce once; the changing step text is decorative. */}
      <span className="sr-only" role="status">
        Upload complete. Reading your resume, this can take a few seconds.
      </span>
      <div
        className="relative mt-4 h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-500/15"
        role="progressbar"
        aria-label="Reading your resume"
        aria-valuetext="In progress"
      >
        <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 animate-indeterminate motion-reduce:w-full motion-reduce:animate-pulse" />
      </div>
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        Upload complete. This usually takes 10 to 20 seconds.
      </p>
    </div>
  );
}

function UploadSuccess({ resume, file, onReplace }: { resume: Resume; file: File; onReplace: () => void }) {
  const roles = resume.workExperience.length;
  const schools = resume.education.length;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-6" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-slate-900 dark:text-white">Resume uploaded</p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {resume.sourceFileName ?? file.name} · {formatSize(file.size)}
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={onReplace}>
          Upload a different file
        </Button>
      </div>

      <div className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">We found</p>
        <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{resume.contact.fullName}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {[resume.contact.email, resume.contact.location].filter(Boolean).join(" · ")}
        </p>

        <dl className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: roles === 1 ? "Role" : "Roles", value: roles },
            { label: schools === 1 ? "School" : "Schools", value: schools },
            { label: resume.skills.length === 1 ? "Skill" : "Skills", value: resume.skills.length },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
              <dt className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</dt>
              <dd className="mt-0.5 text-2xl font-semibold text-slate-900 dark:text-white">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {resume.skills.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {resume.skills.map((skill) => (
              <li
                key={skill}
                className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
              >
                {skill}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:border-slate-800 dark:bg-slate-950/40">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Check these details and fill in anything we missed.
        </p>
        <Link
          href="/dashboard/review"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-500/40 focus-visible:outline-none dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          Review details
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
