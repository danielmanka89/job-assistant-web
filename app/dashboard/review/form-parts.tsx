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
      className="scroll-mt-24 rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:border-slate-800">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            {icon}
          </span>
          <div>
            <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
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
      className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:ring-4 focus-visible:ring-indigo-500/30 focus-visible:outline-none sm:self-auto dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
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
      className={`grid size-8 place-items-center rounded-lg text-slate-400 transition focus-visible:ring-4 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30 ${
        tone === "danger"
          ? "hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-rose-500/20 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          : "hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-indigo-500/20 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-white">{title}</p>
          {subtitle && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
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
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700 select-none dark:text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 cursor-pointer rounded accent-indigo-600"
      />
      {label}
    </label>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {children}
    </p>
  );
}

/** Tag-style input: Enter or comma adds a skill, Backspace on an empty input removes the last one. */
export function SkillsInput({ skills, onChange }: { skills: string[]; onChange: (skills: string[]) => void }) {
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
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:border-indigo-400">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pr-1 pl-3 text-sm font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
          >
            {skill}
            <button
              type="button"
              onClick={() => onChange(skills.filter((s) => s !== skill))}
              aria-label={`Remove ${skill}`}
              className="grid size-5 place-items-center rounded-full text-indigo-400 transition hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-500/30 dark:hover:text-indigo-200"
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
          placeholder={skills.length ? "Add another skill" : "e.g. React, SQL, Project management"}
          className="min-w-40 flex-1 bg-transparent px-2 py-1.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
      </div>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Press Enter or type a comma to add. You can paste a comma-separated list.
      </p>
    </div>
  );
}
