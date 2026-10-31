"use client";

import { useId, useState } from "react";
import type { ApiError, Resume } from "@/lib/types";
import { generateSummaryOptions, saveSummary } from "@/lib/client/api";
import type { SummaryOption } from "@/lib/client/summary";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";

type Props = {
  resumeId: string;
  gapAnalysisId: string;
  /** The summary currently on the resume. */
  summary: string | undefined;
  matchedCount: number;
  /** Another action is running, or the results are out of date. */
  disabled: boolean;
  onSaved: (resume: Resume) => void;
  onUnauthorized: () => void;
};

type Status = "idle" | "generating" | "choosing" | "saving";

function isUnauthorized(error: ApiError) {
  return error.code === "UNAUTHORIZED" || error.code === "HTTP_401";
}

function generateErrorMessage(error: ApiError): string {
  if (error.code === "HTTP_404") return "Summary suggestions aren't available yet. Please try again once the service is running.";
  if (error.code === "ANALYSIS_NOT_FOUND" || error.fieldErrors?.gapAnalysisId) {
    return "This job match is no longer available. Click Analyze Again, then generate new options.";
  }
  if (error.code === "RESUME_NOT_FOUND" || error.fieldErrors?.resumeId) {
    return "We couldn't find this resume on the server anymore. Please upload it again from the dashboard.";
  }
  return error.message;
}

export function SummaryOptimizer({
  resumeId,
  gapAnalysisId,
  summary,
  matchedCount,
  disabled,
  onSaved,
  onUnauthorized,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [options, setOptions] = useState<SummaryOption[]>([]);
  const [choice, setChoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const groupName = useId();

  const busy = status === "generating" || status === "saving";
  const locked = disabled || busy;

  async function onGenerate() {
    setError(null);
    setJustSaved(false);
    setStatus("generating");
    const result = await generateSummaryOptions({ resumeId, gapAnalysisId });
    if (!result.ok) {
      if (isUnauthorized(result.error)) return onUnauthorized();
      setError(generateErrorMessage(result.error));
      setStatus(options.length > 0 ? "choosing" : "idle");
      return;
    }
    if (result.data.length === 0) {
      setError("We couldn't come up with summary options for this job. Please try again.");
      setStatus(options.length > 0 ? "choosing" : "idle");
      return;
    }
    setOptions(result.data.slice(0, 3));
    setChoice(null);
    setStatus("choosing");
  }

  async function onConfirm() {
    const picked = options.find((o) => o.id === choice);
    if (!picked) return;
    setError(null);
    setStatus("saving");
    const result = await saveSummary(resumeId, picked.text);
    if (!result.ok) {
      if (isUnauthorized(result.error)) return onUnauthorized();
      const { code, message, fieldErrors } = result.error;
      setError(
        code === "RESUME_NOT_FOUND" || code === "HTTP_404"
          ? "We couldn't find this resume on the server anymore. Please upload it again from the dashboard."
          : (fieldErrors?.summary ?? message),
      );
      setStatus("choosing");
      return;
    }
    onSaved(result.data);
    setOptions([]);
    setChoice(null);
    setJustSaved(true);
    setStatus("idle");
  }

  const showOptions = status === "choosing" || status === "saving";

  return (
    <section
      aria-labelledby="summary-title"
      aria-busy={busy || undefined}
      className="rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <div className="flex flex-col gap-4 border-b border-neutral-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:border-neutral-800">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden="true">
              <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z" />
            </svg>
          </span>
          <div>
            <h3 id="summary-title" className="text-lg font-semibold text-neutral-900 dark:text-white">
              Optimize Professional Summary
            </h3>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              Three AI-written options built around the {matchedCount} {matchedCount === 1 ? "keyword" : "keywords"} you
              already match.
            </p>
          </div>
        </div>
        {!showOptions && (
          <Button
            type="button"
            onClick={onGenerate}
            loading={status === "generating"}
            disabled={locked}
            className="shrink-0 self-start sm:self-auto"
          >
            {status === "generating" ? "Writing options…" : "Generate Summary Options"}
          </Button>
        )}
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-8">
        {justSaved && (
          <p
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
            </svg>
            Summary updated. Your tailored resume will use it.
          </p>
        )}
        {error && <ErrorAlert>{error}</ErrorAlert>}

        <div>
          <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
            {justSaved ? "Your new summary" : "Current summary"}
          </p>
          {summary?.trim() ? (
            <p
              className={`mt-2 rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-neutral-800 dark:text-neutral-200 ${
                justSaved
                  ? "bg-emerald-50/70 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30"
                  : "bg-neutral-50 dark:bg-neutral-800/50"
              }`}
            >
              {summary}
            </p>
          ) : (
            <p className="mt-2 rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              Your resume doesn&apos;t have a summary yet. Generate options to add one.
            </p>
          )}
        </div>

        {status === "generating" && <OptionsSkeleton />}

        {showOptions && (
          <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
            <legend className="text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
              Pick a new summary
            </legend>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {options.map((option, i) => {
                const checked = choice === option.id;
                return (
                  <label
                    key={option.id}
                    className={`relative flex cursor-pointer gap-3 rounded-2xl border p-4 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/30 has-[:disabled]:cursor-not-allowed ${
                      checked
                        ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500 dark:border-brand-400 dark:bg-brand-500/[0.07] dark:ring-brand-400"
                        : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name={groupName}
                      value={option.id}
                      checked={checked}
                      onChange={() => setChoice(option.id)}
                      className="mt-0.5 size-4 shrink-0 accent-brand-600"
                    />
                    <span className="min-w-0">
                      <span className="text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                        Option {i + 1}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                        {option.text}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onGenerate}
                className="self-start rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto dark:text-brand-400 dark:hover:bg-brand-500/10"
              >
                Generate new options
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOptions([]);
                    setChoice(null);
                    setError(null);
                    setStatus("idle");
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Keep current
                </button>
                <Button
                  type="button"
                  onClick={onConfirm}
                  loading={status === "saving"}
                  disabled={!choice}
                  className="min-w-44"
                >
                  {status === "saving" ? "Saving…" : "Confirm Summary"}
                </Button>
              </div>
            </div>
          </fieldset>
        )}
      </div>
    </section>
  );
}

function OptionsSkeleton() {
  return (
    <div aria-label="Writing summary options" className="grid gap-3 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-700">
          <div className="h-3 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      ))}
    </div>
  );
}
