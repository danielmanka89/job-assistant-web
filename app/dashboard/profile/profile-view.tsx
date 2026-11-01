"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiError, Education, ProfileValues, Resume, WorkExperience } from "@/lib/types";
import { PROFILE_SECTIONS, splitList, type ProfileField, type ProfileSection } from "@/lib/profile";
import { yearsOfExperience } from "@/lib/spreadsheet";
import { getProfile, logout } from "@/lib/client/api";
import { safeApplyUrl } from "@/lib/client/jobs";
import { ErrorAlert } from "@/components/ui/alert";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; values: ProfileValues; updatedAt: string | null; resume: Resume | null };

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

const uploadLink =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-2.5 font-display text-[15px] font-medium tracking-wider text-white uppercase shadow-md shadow-brand-600/30 transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:hover:bg-brand-500";

/**
 * The whole profile, read-only: contact and work details, summary, experience, education, skills and
 * certifications, all from the latest resume. It changes only when a new resume is confirmed.
 */
export function ProfileView() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getProfile().then(async (result) => {
      if (!live) return;
      if (!result.ok && isUnauthorized(result.error)) {
        await logout();
        router.replace("/login");
        return;
      }
      setLoad(result.ok ? { status: "ready", ...result.data } : { status: "error", message: result.error.message });
    });
    return () => {
      live = false;
    };
  }, [attempt, router]);

  if (load.status === "loading") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading your profile">
        {[0, 1].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" aria-hidden="true" />
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

  if (!load.updatedAt) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-300 px-6 py-14 text-center dark:border-neutral-700">
        <p className="font-semibold text-neutral-900 dark:text-white">No profile yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          Your profile is filled in from your resume. Upload it to get started.
        </p>
        <Link href="/dashboard/upload" className={`${uploadLink} mt-6`}>
          Upload resume
        </Link>
      </div>
    );
  }

  const { values } = load;
  const sections = (...ids: ProfileSection["id"][]) =>
    PROFILE_SECTIONS.filter((section) => ids.includes(section.id)).map((section) => (
      <Card key={section.id} id={`profile-${section.id}`} title={section.title} description={section.description}>
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {section.fields.map((field) => (
            <div key={field.key} className={field.type === "list" ? "sm:col-span-2" : undefined}>
              <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{field.label}</dt>
              <dd className="mt-1 text-[15px] break-words text-neutral-900 dark:text-white">
                <Value field={field} value={values[field.key] ?? ""} />
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    ));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200/80 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900/60">
        <p className="flex items-start gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
          </svg>
          <span>
            Synced from your resume on{" "}
            <span className="font-semibold text-neutral-900 dark:text-white">
              {new Date(load.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </span>
            . To change it, use Add to your resume above or upload an updated resume.
          </span>
        </p>
        <Link href="/dashboard/upload" className={`${uploadLink} shrink-0`}>
          Upload new resume
        </Link>
      </div>

      {/* Resume order: contact and work details, summary, experience, education, then skills. */}
      {sections("contact", "work")}

      {load.resume?.summary && (
        <Card id="profile-summary" title="Summary">
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-neutral-700 dark:text-neutral-200">{load.resume.summary}</p>
        </Card>
      )}

      {load.resume && <ExperienceCard resume={load.resume} />}
      {/* The full education history replaces the profile's one-line "highest education". */}
      {load.resume ? <EducationCard education={load.resume.education} /> : sections("education")}
      {sections("skills")}
    </div>
  );
}

function Card({ id, title, description, aside, children }: { id: string; title: string; description?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-xl font-semibold text-neutral-900 dark:text-white">
          {title}
        </h2>
        {aside}
      </div>
      {description && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2021-03" -> "Mar 2021"; anything else is shown as given. */
function month(ym: string | null | undefined): string {
  const m = ym?.match(/^(\d{4})-(\d{2})$/);
  return m ? `${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`.trim() : (ym ?? "");
}

function dateRange(start: string | undefined, end: string | null | undefined, current: string): string {
  const from = month(start);
  const to = end === null ? current : month(end);
  return [from, to].filter(Boolean).join(" – ");
}

function ExperienceCard({ resume }: { resume: Resume }) {
  const years = yearsOfExperience(resume);
  const total = years === null ? null : `${years} ${years === 1 ? "year" : "years"} total`;
  return (
    <Card
      id="profile-experience"
      title="Experience"
      aside={total && <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">{total}</span>}
    >
      {resume.workExperience.length === 0 ? (
        <Missing />
      ) : (
        <ol className="space-y-6">
          {resume.workExperience.map((job) => (
            <Job key={job.id} job={job} />
          ))}
        </ol>
      )}
    </Card>
  );
}

function Job({ job }: { job: WorkExperience }) {
  const bullets = job.bullets.filter((b) => b.text.trim());
  return (
    <li className="border-l-2 border-brand-200 pl-4 dark:border-brand-500/40">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="font-semibold text-neutral-900 dark:text-white">{job.jobTitle}</p>
        <p className="text-sm text-neutral-500 tabular-nums dark:text-neutral-400">{dateRange(job.startDate, job.endDate, "Present")}</p>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">{[job.company, job.location].filter(Boolean).join(" · ")}</p>
      {bullets.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-neutral-700 marker:text-neutral-400 dark:text-neutral-200">
          {bullets.map((b) => (
            <li key={b.id}>{b.text}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** In-progress first, then by end (or start) date, newest first. */
function byRecency(a: Education, b: Education): number {
  const key = (e: Education) => (e.endDate === null ? "9999-99" : (e.endDate ?? e.startDate ?? ""));
  return key(b).localeCompare(key(a));
}

function EducationCard({ education }: { education: Education[] }) {
  return (
    <Card id="profile-education" title="Education">
      {education.length === 0 ? (
        <Missing />
      ) : (
        <ol className="space-y-5">
          {[...education].sort(byRecency).map((e, i) => (
            <li key={e.id} className="border-l-2 border-brand-200 pl-4 dark:border-brand-500/40">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="font-semibold text-neutral-900 dark:text-white">
                  {[e.degree, e.fieldOfStudy].filter(Boolean).join(", ")}
                  {i === 0 && (
                    <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 align-middle text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                      Most recent
                    </span>
                  )}
                </p>
                <p className="text-sm text-neutral-500 tabular-nums dark:text-neutral-400">{dateRange(e.startDate, e.endDate, "In progress")}</p>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">{e.institution}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// Missing details are added with the one "Add to your resume" button next to the page title.
function Missing() {
  return <span className="text-neutral-400 italic dark:text-neutral-500">Not on your resume</span>;
}

function Value({ field, value }: { field: ProfileField; value: string }) {
  if (!value) return <Missing />;
  if (field.type === "list") {
    return (
      <ul className="mt-1 flex flex-wrap gap-2">
        {/* Index in the key: a resume can list the same skill twice. */}
        {splitList(value).map((item, i) => (
          <li key={`${i}-${item}`} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {item}
          </li>
        ))}
      </ul>
    );
  }
  if (field.type === "url") {
    // Values come from the parsed resume; only web links become clickable.
    const href = safeApplyUrl(value);
    if (!href) return <>{value}</>;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
        {value.replace(/^https?:\/\//, "")}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return <>{value}</>;
}
