"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { ApiError, ResumeCompareResponse } from "@/lib/types";
import { compareResume, confirmResumeSync, logout } from "@/lib/client/api";
import { storeResume } from "@/lib/client/resume-storage";
import { ErrorAlert } from "@/components/ui/alert";
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
  // The resume would change the profile: the user confirms before anything is saved.
  | { status: "review"; file: File; compared: ResumeCompareResponse; saving: boolean; error?: string }
  | { status: "saving"; file: File }
  | { status: "error"; message: string };

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

function checkFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const okType =
    ACCEPTED_MIME.includes(file.type) || ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!okType) return "Only PDF or DOCX files are supported.";
  if (file.size > MAX_BYTES) return "That file is over 10 MB. Try a smaller export.";
  if (file.size === 0) return "That file is empty.";
  return null;
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

    // Read the file and compare it with the profile; nothing is saved yet.
    setState({ status: "uploading", file, progress: 0 });
    const result = await compareResume(file, (progress) =>
      setState((s) => (s.status === "uploading" ? { ...s, progress } : s)),
    );
    if (!result.ok) return fail(result.error);
    if (result.data.changes.length === 0) return confirm(file, result.data); // profile already matches
    setState({ status: "review", file, compared: result.data, saving: false });
  }

  /** Saves the resume and updates the profile to match, then goes to the dashboard. */
  async function confirm(file: File, compared: ResumeCompareResponse) {
    setState((s) => (s.status === "review" ? { ...s, saving: true, error: undefined } : { status: "saving", file }));
    const result = await confirmResumeSync(file, compared);
    if (!result.ok) {
      if (isUnauthorized(result.error)) return fail(result.error);
      const message = result.error.message;
      setState((s) => (s.status === "review" ? { ...s, saving: false, error: message } : { status: "error", message }));
      return;
    }
    storeResume(result.data.resume);
    router.push(`/dashboard?resume=synced&changes=${result.data.changes.length}`);
  }

  async function fail(error: ApiError) {
    if (isUnauthorized(error)) {
      await logout();
      router.replace("/login");
      return;
    }
    setState({ status: "error", message: error.message });
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
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void start(file);
  }

  function reset() {
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = state.status === "uploading" || state.status === "review" || state.status === "saving";

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
            ? "scale-[1.01] border-brand-500 bg-brand-50/80 dark:border-brand-400 dark:bg-brand-500/10"
            : state.status === "error"
              ? "border-rose-300 bg-white dark:border-rose-500/50 dark:bg-neutral-900/50"
              : "border-neutral-300 bg-white hover:border-brand-400 dark:border-neutral-700 dark:bg-neutral-900/50 dark:hover:border-brand-500",
        ].join(" ")}
      >
        <div
          className={`grid size-16 place-items-center rounded-2xl transition ${
            dragging
              ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30"
              : "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-8" aria-hidden="true">
            <path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {state.status === "uploading" ? (
          state.progress < 100 ? (
            <UploadProgress fileName={state.file.name} progress={state.progress} />
          ) : (
            <ReadingProgress fileName={state.file.name} />
          )
        ) : state.status === "saving" || state.status === "review" ? (
          <SavingProgress fileName={state.file.name} />
        ) : (
          <>
            <p className="mt-6 text-lg font-semibold text-neutral-900 dark:text-white">
              {dragging ? "Drop it here" : "Drag and drop your resume"}
            </p>
            <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">PDF or DOCX, up to 10 MB</p>
            <div className="mt-6 flex items-center gap-3 text-sm text-neutral-400">
              <span className="h-px w-10 bg-neutral-200 dark:bg-neutral-700" />
              or
              <span className="h-px w-10 bg-neutral-200 dark:bg-neutral-700" />
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

      {state.status === "review" && (
        <SyncDialog
          compared={state.compared}
          saving={state.saving}
          error={state.error}
          onConfirm={() => confirm(state.file, state.compared)}
          onCancel={reset}
        />
      )}
    </div>
  );
}

function UploadProgress({ fileName, progress }: { fileName: string; progress: number }) {
  return (
    <div className="mt-6 w-full max-w-sm" aria-live="polite">
      <p className="truncate text-base font-semibold text-neutral-900 dark:text-white">{fileName}</p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Uploading… {progress}%</p>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Upload progress"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-[width] duration-200"
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
      <p className="truncate text-base font-semibold text-neutral-900 dark:text-white">{fileName}</p>
      <p className="mt-1 flex items-center justify-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400">
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
        className="relative mt-4 h-2 overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/15"
        role="progressbar"
        aria-label="Reading your resume"
        aria-valuetext="In progress"
      >
        <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 animate-indeterminate motion-reduce:w-full motion-reduce:animate-pulse" />
      </div>
      <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        Upload complete. This usually takes 10 to 20 seconds.
      </p>
    </div>
  );
}

function SavingProgress({ fileName }: { fileName: string }) {
  return (
    <div className="mt-6 w-full max-w-sm" role="status">
      <p className="truncate text-base font-semibold text-neutral-900 dark:text-white">{fileName}</p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Saving your resume and profile…</p>
    </div>
  );
}

const empty = <span className="text-neutral-400 italic dark:text-neutral-500">Not set</span>;

/**
 * Lists what the uploaded resume changes in the profile (Old Profile vs New Resume) and asks the
 * user to confirm. Uses <dialog> for focus trapping and Escape; nothing is saved on cancel.
 */
function SyncDialog({
  compared,
  saving,
  error,
  onConfirm,
  onCancel,
}: {
  compared: ResumeCompareResponse;
  saving: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="sync-title"
      aria-describedby="sync-description"
      onCancel={(e) => {
        e.preventDefault(); // Escape: close through onCancel so state stays in step
        if (!saving) onCancel();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-3xl border border-neutral-200 bg-white p-0 text-left shadow-2xl backdrop:bg-neutral-950/50 backdrop:backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="border-b border-neutral-100 px-6 pt-6 pb-5 sm:px-8 dark:border-neutral-800">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6" aria-hidden="true">
                <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.66 5.66L4 15.5M4 20v-4.5h4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <h2 id="sync-title" className="text-xl font-semibold text-neutral-900 dark:text-white">
                Update your profile?
              </h2>
              <p id="sync-description" className="mt-1 text-[15px] text-neutral-600 dark:text-neutral-300">
                We found new details in your resume. Your profile will be updated to match.
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Profile changes from your resume</caption>
            <thead className="max-sm:sr-only">
              <tr className="text-left text-xs font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
                <th scope="col" className="w-1/5 pb-2">
                  Field
                </th>
                <th scope="col" className="w-2/5 pb-2">
                  Old Profile
                </th>
                <th scope="col" className="w-2/5 pb-2">
                  New Resume
                </th>
              </tr>
            </thead>
            <tbody>
              {compared.changes.map((c) => (
                <tr key={c.field} className="max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:border-t max-sm:border-neutral-100 max-sm:py-3 max-sm:dark:border-neutral-800">
                  <th scope="row" className="border-t border-neutral-100 py-3 pr-4 text-left align-top font-semibold text-neutral-900 max-sm:border-0 max-sm:py-0 dark:border-neutral-800 dark:text-white">
                    {c.label}
                  </th>
                  <td className="border-t border-neutral-100 py-3 pr-4 align-top break-words text-neutral-500 max-sm:border-0 max-sm:py-0 dark:border-neutral-800 dark:text-neutral-400">
                    <span className="sm:hidden">Old: </span>
                    {c.from ? <span className="line-through decoration-neutral-300 dark:decoration-neutral-600">{c.from}</span> : empty}
                  </td>
                  <td className="border-t border-neutral-100 py-3 align-top break-words font-medium text-brand-700 max-sm:border-0 max-sm:py-0 dark:border-neutral-800 dark:text-brand-300">
                    <span className="font-normal text-neutral-500 sm:hidden dark:text-neutral-400">New: </span>
                    {c.to || <span className="text-neutral-400 italic dark:text-neutral-500">Will be cleared</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
            Work authorization, rate, availability and certifications aren&apos;t on a resume, so they stay as they are.
          </p>
        </div>

        <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/70 px-6 py-5 sm:px-8 dark:border-neutral-800 dark:bg-neutral-950/40">
          {error && <ErrorAlert>{error}</ErrorAlert>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm} loading={saving}>
              {saving ? "Updating…" : "Confirm & Update Profile"}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
