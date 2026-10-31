"use client";

import { useId, type TextareaHTMLAttributes } from "react";

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: string;
  hideLabel?: boolean;
  error?: string;
  hint?: string;
};

export function TextArea({ label, hideLabel = false, error, hint, className, rows = 3, ...props }: TextAreaProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={hideLabel ? "sr-only" : "mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-200"}
      >
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          "block w-full resize-y rounded-xl border bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-neutral-900 shadow-sm outline-none transition",
          "placeholder:text-neutral-400 focus:ring-4 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500",
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15"
            : "border-neutral-200 focus:border-brand-500 focus:ring-brand-500/15 dark:border-neutral-700 dark:focus:border-brand-400",
        ].join(" ")}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
