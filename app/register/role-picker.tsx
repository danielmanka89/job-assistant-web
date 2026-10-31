"use client";

import { useId } from "react";
import type { UserRole } from "@/lib/types";

const OPTIONS: { value: UserRole; title: string; body: string; icon: React.ReactNode }[] = [
  {
    value: "SEEKER",
    title: "I am a Job Seeker",
    body: "Tailor my resume to jobs",
    icon: (
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6m-6 4h4" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    value: "EMPLOYER",
    title: "I am an Employer",
    body: "Post jobs for candidates",
    icon: (
      <path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm0 4h16" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
];

/** Account type choice on the register form, as two large radio cards. */
export function RolePicker({
  value,
  onChange,
  error,
}: {
  value: UserRole;
  onChange: (role: UserRole) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-error` : undefined} className="mx-0 min-w-0 border-0 p-0">
      <legend className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200">Account type</legend>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={`relative flex cursor-pointer flex-col gap-2 rounded-2xl border p-3.5 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-500/25 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70 ${
                checked
                  ? "border-brand-500 bg-brand-50 shadow-sm dark:border-brand-400 dark:bg-brand-500/10"
                  : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="flex items-center justify-between">
                <span
                  className={`grid size-8 place-items-center rounded-lg ${
                    checked
                      ? "bg-brand-600 text-white"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
                    {option.icon}
                  </svg>
                </span>
                <span
                  aria-hidden="true"
                  className={`grid size-4 place-items-center rounded-full border ${
                    checked ? "border-brand-600 bg-brand-600 dark:border-brand-400 dark:bg-brand-500" : "border-neutral-300 dark:border-neutral-600"
                  }`}
                >
                  {checked && <span className="size-1.5 rounded-full bg-white" />}
                </span>
              </span>
              <span>
                <span className="block text-sm leading-snug font-semibold text-neutral-900 dark:text-white">{option.title}</span>
                <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">{option.body}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}
