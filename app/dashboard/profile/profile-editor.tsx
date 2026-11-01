"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiError, ProfileValues } from "@/lib/types";
import { PROFILE_SECTIONS, validateProfile, type ProfileField } from "@/lib/profile";
import { getProfile, logout, saveProfile } from "@/lib/client/api";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; saved: ProfileValues; updatedAt: string | null; prefilled: boolean };

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";
const sameValues = (a: ProfileValues, b: ProfileValues) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => (a[k] ?? "").trim() === (b[k] ?? "").trim());
};

/** Loads the profile (or suggestions for a new one) and shows it as one form with three sections. */
export function ProfileEditor() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [values, setValues] = useState<ProfileValues>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getProfile().then(async (result) => {
      if (!live) return;
      if (!result.ok) {
        if (isUnauthorized(result.error)) {
          await logout();
          router.replace("/login");
          return;
        }
        setLoad({ status: "error", message: result.error.message });
        return;
      }
      const { values: saved, updatedAt, suggestions } = result.data;
      const prefilled = !updatedAt && Object.keys(suggestions).length > 0;
      setLoad({ status: "ready", saved, updatedAt, prefilled });
      setValues(updatedAt ? saved : suggestions);
    });
    return () => {
      live = false;
    };
  }, [attempt, router]);

  if (load.status === "loading") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading your profile">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className="space-y-3">
        <ErrorAlert>{load.message}</ErrorAlert>
        <button
          type="button"
          onClick={() => {
            setLoad({ status: "loading" });
            setAttempt((n) => n + 1);
          }}
          className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <ProfileForm
      values={values}
      setValues={setValues}
      saved={load.saved}
      updatedAt={load.updatedAt}
      prefilled={load.prefilled}
      onSaved={(saved, updatedAt) => {
        setLoad({ status: "ready", saved, updatedAt, prefilled: false });
        setValues(saved);
      }}
      onUnauthorized={async () => {
        await logout();
        router.replace("/login");
      }}
    />
  );
}

function ProfileForm({
  values,
  setValues,
  saved,
  updatedAt,
  prefilled,
  onSaved,
  onUnauthorized,
}: {
  values: ProfileValues;
  setValues: (update: (v: ProfileValues) => ProfileValues) => void;
  saved: ProfileValues;
  updatedAt: string | null;
  prefilled: boolean;
  onSaved: (saved: ProfileValues, updatedAt: string | null) => void;
  onUnauthorized: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  // A new profile can be saved as suggested; a saved one only once something changed.
  const dirty = !updatedAt || !sameValues(values, saved);

  useEffect(() => {
    if (!success && !formError) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [success, formError]);

  function update(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setSuccess(false);
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  function showErrors(fieldErrors: Record<string, string>) {
    setErrors(fieldErrors);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);
    const check = validateProfile(values);
    if (Object.keys(check.fieldErrors).length) return showErrors(check.fieldErrors);

    setPending(true);
    const result = await saveProfile(check.values);
    setPending(false);
    if (!result.ok) {
      if (isUnauthorized(result.error)) return onUnauthorized();
      const known = Object.fromEntries(Object.entries(result.error.fieldErrors ?? {}).filter(([k]) => PROFILE_SECTIONS.some((s) => s.fields.some((f) => f.key === k))));
      if (Object.keys(known).length) showErrors(known);
      else setFormError(result.error.message);
      return;
    }
    setErrors({});
    setSuccess(true);
    onSaved(result.data.values, result.data.updatedAt);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
      <div ref={feedbackRef} className="scroll-mt-24 space-y-3">
        {success && (
          <Notice tone="success">
            Profile saved. It will be used the next time you click Apply on the{" "}
            <Link href="/dashboard/jobs" className="font-semibold underline underline-offset-2">
              Job Board
            </Link>{" "}
            or tailor your resume.
          </Notice>
        )}
        {formError && <ErrorAlert>{formError}</ErrorAlert>}
        {prefilled && !success && (
          <Notice tone="info">
            We filled this in from your account and your latest resume. Check it, add your work details, and save.
          </Notice>
        )}
      </div>

      <fieldset disabled={pending} className="m-0 min-w-0 space-y-6 border-0 p-0">
        {PROFILE_SECTIONS.map((section, i) => (
          <section
            key={section.title}
            aria-labelledby={`profile-section-${i}`}
            className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/60"
          >
            <h2 id={`profile-section-${i}`} className="text-xl font-semibold text-neutral-900 dark:text-white">
              {section.title}
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{section.description}</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {section.fields.map((field) => (
                <Field key={field.key} field={field} value={values[field.key] ?? ""} error={errors[field.key]} onChange={(v) => update(field.key, v)} />
              ))}
            </div>
          </section>
        ))}
      </fieldset>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
          {updatedAt
            ? `Last saved ${new Date(updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
            : "Not saved yet"}
        </p>
        <Button type="submit" loading={pending} disabled={!dirty}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

const SELECT =
  "block w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] text-neutral-900 shadow-sm outline-none transition focus:ring-4 dark:bg-neutral-900 dark:text-neutral-100";

function Field({ field, value, error, onChange }: { field: ProfileField; value: string; error?: string; onChange: (value: string) => void }) {
  const max = field.maxLength ?? 200;
  if (field.type === "long") {
    return (
      <TextArea
        label={field.label}
        hint={field.hint}
        error={error}
        rows={3}
        maxLength={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sm:col-span-2"
      />
    );
  }
  if (field.type === "select") {
    const id = `profile-${field.key}`;
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {field.label}
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${SELECT} ${error ? "border-rose-400" : "border-neutral-200 focus:border-brand-500 focus:ring-brand-500/15 dark:border-neutral-700"}`}
        >
          <option value="">Not set</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${id}-error`} className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
    );
  }
  const inputType = field.type === "email" || field.type === "url" || field.type === "tel" ? field.type : "text";
  const autoComplete: Record<string, string> = { fullName: "name", email: "email", phone: "tel", location: "address-level2", linkedinUrl: "url", websiteUrl: "url" };
  return (
    <TextField
      label={field.label}
      type={inputType}
      inputMode={field.type === "years" ? "decimal" : undefined}
      autoComplete={autoComplete[field.key] ?? "off"}
      hint={field.hint}
      error={error}
      maxLength={max}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Notice({ tone, children }: { tone: "success" | "info"; children: ReactNode }) {
  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200";
  return (
    <div role="status" className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      <p>{children}</p>
    </div>
  );
}
