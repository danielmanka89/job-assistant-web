"use client";

import { useId, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";

export function Section({
  id,
  title,
  description,
  icon,
  action,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <div className="flex flex-col gap-4 border-b border-neutral-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:border-neutral-800">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            {icon}
          </span>
          <div>
            <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="px-5 py-6 sm:px-8">{children}</div>
    </section>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none sm:self-auto dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
        <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
      </svg>
      {children}
    </button>
  );
}

const ICONS = {
  up: "M14.77 12.79a.75.75 0 0 1-1.06-.02L10 8.832 6.29 12.77a.75.75 0 1 1-1.08-1.04l4.25-4.5a.75.75 0 0 1 1.08 0l4.25 4.5a.75.75 0 0 1-.02 1.06Z",
  down: "M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z",
  remove:
    "M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z",
};

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  tone = "neutral",
}: {
  icon: keyof typeof ICONS;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-lg text-neutral-400 transition focus-visible:ring-4 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30 ${
        tone === "danger"
          ? "hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-rose-500/20 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          : "hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-brand-500/20 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      }`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
        <path fillRule="evenodd" clipRule="evenodd" d={ICONS[icon]} />
      </svg>
    </button>
  );
}

export function ItemCard({
  title,
  subtitle,
  index,
  count,
  kind,
  onMove,
  onRemove,
  children,
}: {
  title: string;
  subtitle?: string;
  index: number;
  count: number;
  kind: string;
  onMove: (to: number) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:p-6 dark:border-neutral-800 dark:bg-neutral-950/40">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900 dark:text-white">{title}</p>
          {subtitle && <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton icon="up" label={`Move ${kind} up`} onClick={() => onMove(index - 1)} disabled={index === 0} />
          <IconButton
            icon="down"
            label={`Move ${kind} down`}
            onClick={() => onMove(index + 1)}
            disabled={index === count - 1}
          />
          <IconButton icon="remove" label={`Remove ${kind}`} onClick={onRemove} tone="danger" />
        </div>
      </div>
      {children}
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-neutral-700 select-none dark:text-neutral-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer rounded accent-brand-600"
      />
      {label}
    </label>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
      {children}
    </p>
  );
}

/** Tag-style input: Enter or comma adds a skill, Backspace on an empty input removes the last one. */
export function SkillsInput({
  skills,
  onChange,
  error,
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
  error?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const seen = new Set(skills.map((s) => s.toLowerCase()));
    const next = [...skills];
    for (const part of parts) {
      if (!seen.has(part.toLowerCase())) {
        next.push(part);
        seen.add(part.toLowerCase());
      }
    }
    onChange(next);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && skills.length > 0) {
      onChange(skills.slice(0, -1));
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (text.includes(",")) {
      e.preventDefault();
      add(draft + text);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Add a skill
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15 dark:border-neutral-700 dark:bg-neutral-900 dark:focus-within:border-brand-400">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pr-1 pl-3 text-sm font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          >
            {skill}
            <button
              type="button"
              onClick={() => onChange(skills.filter((s) => s !== skill))}
              aria-label={`Remove ${skill}`}
              className="grid size-5 place-items-center rounded-full text-brand-400 transition hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-500/30 dark:hover:text-brand-200"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => add(draft)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help`}
          placeholder={skills.length ? "Add another skill" : "e.g. React, SQL, Project management"}
          className="min-w-40 flex-1 bg-transparent px-2 py-1.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
        />
      </div>
      <p
        id={`${id}-help`}
        className={`mt-2 text-sm ${error ? "text-rose-600 dark:text-rose-400" : "text-neutral-500 dark:text-neutral-400"}`}
      >
        {error ?? "Press Enter or type a comma to add. You can paste a comma-separated list."}
      </p>
    </div>
  );
}
