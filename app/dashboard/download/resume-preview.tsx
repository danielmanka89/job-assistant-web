"use client";

import { useId, useState } from "react";
import type { Education, Resume, ResumeContact, SuggestedBullet, TailoredResume, WorkExperience } from "@/lib/types";

type View = "after" | "before";

type Props = {
  original: Resume;
  tailored: TailoredResume;
  accepted: SuggestedBullet[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2022-03" -> "Mar 2022"; null end dates read as "Present". */
function formatMonth(value: string | null | undefined, isEnd = false): string {
  if (value === null || (isEnd && value === undefined)) return "Present";
  if (!value) return "";
  const [year, month] = value.split("-");
  const name = MONTHS[Number(month) - 1];
  return name ? `${name} ${year}` : year;
}

function dateRange(start: string, end: string | null | undefined) {
  return [formatMonth(start), formatMonth(end, true)].filter(Boolean).join(" – ");
}

export function ResumePreview({ original, tailored, accepted }: Props) {
  const [view, setView] = useState<View>("after");
  const [highlight, setHighlight] = useState(true);
  const tabsId = useId();

  // Bullets are matched by text: after = the accepted wording, before = the wording it replaces.
  const changedAfter = new Set(accepted.map((b) => b.text.trim()));
  const changedBefore = new Set(accepted.map((b) => b.originalText.trim()));
  const resume = view === "after" ? tailored : original;
  const changed = view === "after" ? changedAfter : changedBefore;

  return (
    <section aria-label="Resume preview" className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Compare versions" className="inline-flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
          {(["after", "before"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              id={`${tabsId}-${v}`}
              aria-selected={view === v}
              aria-controls={`${tabsId}-panel`}
              onClick={() => setView(v)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                view === v
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {v === "after" ? "After (tailored)" : "Before (original)"}
            </button>
          ))}
        </div>
        {accepted.length > 0 && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 select-none dark:text-slate-300">
            <input
              type="checkbox"
              checked={highlight}
              onChange={(e) => setHighlight(e.target.checked)}
              className="size-4 cursor-pointer rounded accent-indigo-600"
            />
            Highlight changes
          </label>
        )}
      </div>

      <article
        id={`${tabsId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${view}`}
        className="rounded-2xl bg-white px-6 py-8 text-slate-800 shadow-xl ring-1 shadow-slate-300/40 ring-slate-200 sm:px-12 sm:py-12 dark:shadow-none dark:ring-slate-700"
      >
        <Header contact={resume.contact} />
        {resume.summary && (
          <PaperSection title="Summary">
            <p className="text-[14px] leading-relaxed">{resume.summary}</p>
          </PaperSection>
        )}
        {resume.workExperience.length > 0 && (
          <PaperSection title="Experience">
            <div className="space-y-5">
              {resume.workExperience.map((job) => (
                <Job key={job.id} job={job} changed={highlight ? changed : null} view={view} />
              ))}
            </div>
          </PaperSection>
        )}
        {resume.education.length > 0 && (
          <PaperSection title="Education">
            <div className="space-y-3">
              {resume.education.map((ed) => (
                <School key={ed.id} education={ed} />
              ))}
            </div>
          </PaperSection>
        )}
        {resume.skills.length > 0 && (
          <PaperSection title="Skills">
            <p className="text-[14px] leading-relaxed">{resume.skills.join(" · ")}</p>
          </PaperSection>
        )}
      </article>

      {highlight && accepted.length > 0 && (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {view === "after" ? (
            <>
              <Swatch tone="after" /> Updated bullets
            </>
          ) : (
            <>
              <Swatch tone="before" /> Bullets that were replaced
            </>
          )}
        </p>
      )}
    </section>
  );
}

function Swatch({ tone }: { tone: View }) {
  return (
    <span
      aria-hidden="true"
      className={`mr-1.5 inline-block size-3 rounded-sm align-[-1px] ${
        tone === "after" ? "bg-emerald-200 ring-1 ring-emerald-400" : "bg-rose-100 ring-1 ring-rose-300"
      }`}
    />
  );
}

function Header({ contact }: { contact: ResumeContact }) {
  const details = [contact.email, contact.phone, contact.location].filter(Boolean);
  const links = [contact.linkedinUrl, contact.websiteUrl].filter(Boolean);
  return (
    <header className="border-b border-slate-200 pb-5 text-center">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{contact.fullName}</h2>
      {details.length > 0 && <p className="mt-1.5 text-[13px] text-slate-500">{details.join("  ·  ")}</p>}
      {links.length > 0 && <p className="mt-1 text-[13px] break-all text-indigo-700">{links.join("  ·  ")}</p>}
    </header>
  );
}

function PaperSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2.5 border-b border-slate-200 pb-1 text-[12px] font-bold tracking-[0.14em] text-slate-500 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Job({ job, changed, view }: { job: WorkExperience; changed: Set<string> | null; view: View }) {
  return (
    <div>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="text-[15px] font-semibold text-slate-900">
          {job.jobTitle}
          {job.company && <span className="font-normal text-slate-600">, {job.company}</span>}
        </p>
        <p className="shrink-0 text-[13px] text-slate-500">{dateRange(job.startDate, job.endDate)}</p>
      </div>
      {job.location && <p className="text-[13px] text-slate-500">{job.location}</p>}
      {job.bullets.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {job.bullets.map((bullet) => {
            const isChanged = changed?.has(bullet.text.trim()) ?? false;
            return (
              <li key={bullet.id} className="flex gap-2.5 text-[14px] leading-relaxed">
                <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-slate-400" />
                <span
                  className={
                    isChanged
                      ? view === "after"
                        ? "-mx-1 rounded bg-emerald-100 px-1 text-emerald-950 ring-1 ring-emerald-300"
                        : "-mx-1 rounded bg-rose-50 px-1 text-rose-900 line-through decoration-rose-300 ring-1 ring-rose-200"
                      : undefined
                  }
                >
                  {bullet.text}
                  {isChanged && <span className="sr-only">{view === "after" ? " (updated)" : " (replaced)"}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function School({ education }: { education: Education }) {
  const degree = [education.degree, education.fieldOfStudy].filter(Boolean).join(", ");
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <p className="text-[14px]">
        <span className="font-semibold text-slate-900">{education.institution}</span>
        {degree && <span className="text-slate-600">, {degree}</span>}
      </p>
      {(education.startDate || education.endDate) && (
        <p className="shrink-0 text-[13px] text-slate-500">
          {[formatMonth(education.startDate), formatMonth(education.endDate)].filter(Boolean).join(" – ")}
        </p>
      )}
    </div>
  );
}
