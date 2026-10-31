"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CreateJobPostingRequest, JobPosting } from "@/lib/types";
import { logout, postJob } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/alert";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import {
  DESCRIPTION_MAX,
  EMPTY_JOB,
  JOB_FIELDS,
  LIMITS,
  cleanJob,
  splitServerErrors,
  validateJob,
  type JobField,
  type JobFormErrors,
} from "./job-form-validation";

export function JobPostForm({
  onPosted,
  onForbidden,
}: {
  onPosted: (job: JobPosting) => void;
  /** The API says this account isn't an employer. */
  onForbidden: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<CreateJobPostingRequest>(EMPTY_JOB);
  const [errors, setErrors] = useState<JobFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [success, setSuccess] = useState<JobPosting | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  // After a failed submit, move focus to the first field with a problem.
  useEffect(() => {
    if (focusRequest === 0) return;
    const first = JOB_FIELDS.find((f) => errors[f]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    // Only when a new request comes in, not on every error change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  function update(field: JobField, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (success) setSuccess(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    const clientErrors = validateJob(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      setFocusRequest((n) => n + 1);
      return;
    }

    setPosting(true);
    const result = await postJob(cleanJob(values));
    setPosting(false);

    if (!result.ok) {
      const { code, message, fieldErrors } = result.error;
      if (code === "UNAUTHORIZED" || code === "HTTP_401") {
        await logout();
        router.replace("/login");
        return;
      }
      if (code === "EMPLOYER_ONLY") {
        onForbidden();
        return;
      }
      const { errors: serverErrors, other } = splitServerErrors(fieldErrors);
      setErrors(serverErrors);
      const hasFieldErrors = Object.keys(serverErrors).length > 0;
      setFormError(other.length ? `${message} (${other.join("; ")})` : hasFieldErrors ? null : message);
      setFocusRequest((n) => n + 1);
      return;
    }

    setValues(EMPTY_JOB);
    setErrors({});
    setSuccess(result.data);
    onPosted(result.data);
  }

  const descriptionLength = values.description.length;

  return (
    <section
      aria-labelledby="post-job-title"
      className="rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <div className="flex items-start gap-4 border-b border-neutral-100 px-5 py-5 sm:px-8 dark:border-neutral-800">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
            <path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1m-9 0h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
            <path d="M12 10v6m-3-3h6" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <h2 id="post-job-title" className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
            Post a job
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            All fields are required. The description is what candidates&apos; resumes are matched against.
          </p>
        </div>
      </div>

      <form ref={formRef} onSubmit={onSubmit} noValidate className="px-5 py-6 sm:px-8">
        <fieldset disabled={posting} className="m-0 min-w-0 space-y-5 border-0 p-0">
          {success && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
              </svg>
              <p>
                <span className="font-semibold">{success.title}</span> is live on the{" "}
                <Link href="/dashboard/jobs" className="font-semibold underline underline-offset-2">
                  job board
                </Link>
                .
              </p>
            </div>
          )}
          {formError && <ErrorAlert>{formError}</ErrorAlert>}

          <TextField
            label="Job title"
            name="title"
            placeholder="e.g. Senior Frontend Engineer"
            maxLength={LIMITS.title}
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            error={errors.title}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Company"
              name="company"
              autoComplete="organization"
              placeholder="e.g. Lumen Health"
              maxLength={LIMITS.company}
              value={values.company}
              onChange={(e) => update("company", e.target.value)}
              error={errors.company}
            />
            <TextField
              label="Location"
              name="location"
              placeholder="e.g. Berlin, Germany or Remote"
              maxLength={LIMITS.location}
              value={values.location}
              onChange={(e) => update("location", e.target.value)}
              error={errors.location}
            />
          </div>
          <TextField
            label="Apply URL"
            name="applyUrl"
            type="url"
            inputMode="url"
            placeholder="https://yourcompany.com/careers/role"
            maxLength={LIMITS.applyUrl}
            value={values.applyUrl}
            onChange={(e) => update("applyUrl", e.target.value)}
            error={errors.applyUrl}
            hint="Where candidates go to apply."
          />
          <TextArea
            label="Job description"
            name="description"
            rows={12}
            maxLength={DESCRIPTION_MAX}
            placeholder={"About the role, responsibilities, requirements, nice-to-haves…"}
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
            error={errors.description}
            hint={`${descriptionLength.toLocaleString()} / ${DESCRIPTION_MAX.toLocaleString()} characters. Plain text; line breaks and "- " lists are kept.`}
          />

          <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-end dark:border-neutral-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setValues(EMPTY_JOB);
                setErrors({});
                setFormError(null);
              }}
            >
              Clear
            </Button>
            <Button type="submit" loading={posting} className="sm:min-w-44">
              {posting ? "Posting…" : "Post Job"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
