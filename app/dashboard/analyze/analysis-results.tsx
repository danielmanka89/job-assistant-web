"use client";

import Link from "next/link";
import { matchPercent, withAddedSkills } from "@/lib/skills";
import type { GapAnalysisResponse, Resume, SuggestedBullet } from "@/lib/types";

/** The score the skill picker nudges people toward. */
const TARGET_PERCENT = 90;

type Props = {
  analysis: GapAnalysisResponse;
  resume: Resume;
  accepted: string[];
  onAcceptedChange: (ids: string[]) => void;
  onTailor: () => void;
  tailoring: boolean;
  tailorError: string | null;
  /** The job description was edited after this analysis ran. */
  outdated: boolean;
  /** Missing keywords the user has picked to add to their skills. */
  selectedSkills: string[];
  onSkillsChange: (skills: string[]) => void;
  onAddSkills: () => void;
  addingSkills: boolean;
  skillsError: string | null;
  /** A new analysis is running. */
  busy: boolean;
  /** Shown above the suggested bullets when some keywords already match. */
  summarySection?: React.ReactNode;
};

export function AnalysisResults({
  analysis,
  resume,
  accepted,
  onAcceptedChange,
  onTailor,
  tailoring,
  tailorError,
  outdated,
  selectedSkills,
  onSkillsChange,
  onAddSkills,
  addingSkills,
  skillsError,
  busy,
  summarySection,
}: Props) {
  const { matchedKeywords, missingKeywords, suggestedBullets } = analysis;
  const preview = withAddedSkills(analysis, selectedSkills);
  const pickingLocked = outdated || tailoring || addingSkills || busy;
  const showSkillsBar = selectedSkills.length > 0 || addingSkills;

  function toggleSkill(skill: string) {
    onSkillsChange(
      selectedSkills.includes(skill) ? selectedSkills.filter((s) => s !== skill) : [...selectedSkills, skill],
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Analysis results</h2>
      <MatchSummary
        matched={matchedKeywords.length}
        missing={missingKeywords.length}
        projected={preview}
        adding={selectedSkills.length}
        updating={addingSkills}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <KeywordCard
          tone="matched"
          title="Matched keywords"
          description="In the job description and already on your resume."
          keywords={matchedKeywords}
          empty="None of the posting's keywords were found on your resume yet."
        />
        <KeywordCard
          tone="missing"
          title="Missing keywords"
          description="In the job description but not on your resume."
          keywords={missingKeywords}
          empty="Nice. Your resume covers every keyword we found."
          selected={selectedSkills}
          onToggle={toggleSkill}
          locked={pickingLocked}
          footer={
            missingKeywords.length > 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Tap the ones you have to add them to your skills. Only pick skills that are true for you. You can also
                work them into your bullets on the{" "}
                <Link href="/dashboard/review" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
                  review page
                </Link>
                .
              </p>
            )
          }
        />
      </div>

      {matchedKeywords.length > 0 && summarySection}

      <SuggestionChecklist
        bullets={suggestedBullets}
        resume={resume}
        accepted={accepted}
        onAcceptedChange={onAcceptedChange}
        disabled={tailoring || addingSkills}
      />

      {showSkillsBar ? (
        <SkillsBar
          count={selectedSkills.length}
          from={matchPercent(matchedKeywords.length, missingKeywords.length)}
          to={preview.matchPercent}
          onAdd={onAddSkills}
          onClear={() => onSkillsChange([])}
          adding={addingSkills}
          error={skillsError}
        />
      ) : (
        <TailorBar
        selected={accepted.length}
        total={suggestedBullets.length}
        outdated={outdated}
        onTailor={onTailor}
        tailoring={tailoring}
        error={tailorError ?? skillsError}
      />
      )}
    </div>
  );
}

/** Fewest extra skills that would lift the score to the target, or null if it can't get there. */
function skillsToReach(matched: number, missing: number, target: number): number | null {
  for (let n = 1; n <= missing; n++) {
    if (matchPercent(matched + n, missing - n) >= target) return n;
  }
  return null;
}

const STICKY_BAR =
  "sticky bottom-3 z-10 rounded-2xl px-4 py-3 text-white shadow-2xl ring-1 ring-white/10 sm:bottom-4 sm:rounded-3xl sm:px-8 sm:py-5";

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function SkillsBar({
  count,
  from,
  to,
  onAdd,
  onClear,
  adding,
  error,
}: {
  count: number;
  from: number;
  to: number;
  onAdd: () => void;
  onClear: () => void;
  adding: boolean;
  error: string | null;
}) {
  const noun = count === 1 ? "skill" : "skills";
  return (
    <section
      aria-busy={adding || undefined}
      className={`${STICKY_BAR} bg-gradient-to-br from-emerald-600 to-emerald-900 shadow-emerald-900/30`}
    >
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="hidden text-lg font-semibold sm:block">
            {adding ? "Saving your skills…" : `${count} ${noun} selected`}
          </p>
          <p className="text-xs leading-snug text-emerald-100 sm:mt-0.5 sm:text-sm" aria-live="polite">
            {adding ? (
              "Adding them to your resume and re-running the match."
            ) : (
              <>
                Match goes from {from}% to <span className="font-semibold text-white">{to}%</span>
                <span className="hidden sm:inline">
                  {" "}·{" "}
                  <button
                    type="button"
                    onClick={onClear}
                    className="font-medium underline underline-offset-2 hover:text-white"
                  >
                    Clear selection
                  </button>
                </span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={adding || count === 0}
          aria-busy={adding || undefined}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 font-display text-sm font-medium uppercase tracking-wider text-emerald-800 shadow-sm transition outline-none hover:bg-emerald-50 focus-visible:ring-4 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-70 sm:px-6 sm:py-3 sm:text-[15px]"
        >
          {adding ? (
            <>
              <Spinner />
              Updating…
            </>
          ) : (
            <>
              <span className="sm:hidden">Add {count} &amp; update</span>
              <span className="hidden sm:inline">
                Add {count} selected {noun} and update score
              </span>
            </>
          )}
        </button>
      </div>
      {adding && (
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/25 sm:mt-5" aria-hidden="true">
          <div className="absolute inset-y-0 left-0 w-2/5 animate-indeterminate rounded-full bg-white motion-reduce:w-full motion-reduce:animate-pulse" />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 max-h-32 overflow-y-auto rounded-xl bg-white px-4 py-3 text-sm font-medium text-rose-700 sm:mt-4">
          {error}
        </p>
      )}
    </section>
  );
}

function TailorBar({
  selected,
  total,
  outdated,
  onTailor,
  tailoring,
  error,
}: {
  selected: number;
  total: number;
  outdated: boolean;
  onTailor: () => void;
  tailoring: boolean;
  error: string | null;
}) {
  const message = tailoring
    ? "Building your tailored resume and creating the Word and PDF files. This can take a few seconds."
    : outdated
    ? "Analyze again first. The job description changed since these results were made."
    : selected > 0
      ? `Your resume will be generated with ${selected} updated ${selected === 1 ? "bullet" : "bullets"}.`
      : total > 0
        ? "No changes selected. Your resume will be generated as it is now."
        : "Your resume will be generated as it is now.";

  const shortMessage = tailoring
    ? "Creating your files…"
    : outdated
      ? "Analyze again first."
      : selected > 0
        ? `${selected} ${selected === 1 ? "change" : "changes"} selected`
        : "No changes selected";

  return (
    <section
      aria-busy={tailoring || undefined}
      // Sticks to the bottom of the screen while the results are in view, so the next step is always reachable.
      // Compact on phones so it covers as little of the suggestions as possible.
      className={`${STICKY_BAR} bg-gradient-to-br from-brand-600 to-brand-900 shadow-brand-900/30`}
    >
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h3 className="hidden text-lg font-semibold sm:block">Ready to tailor your resume?</h3>
          <p className="text-xs leading-snug text-brand-100 sm:mt-0.5 sm:text-sm" aria-live="polite">
            <span className="sm:hidden">{shortMessage}</span>
            <span className="hidden sm:inline">{message}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onTailor}
          disabled={outdated || tailoring}
          aria-busy={tailoring || undefined}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 font-display text-sm font-medium uppercase tracking-wider sm:min-w-44 sm:px-6 sm:py-3 sm:text-[15px] text-brand-700 shadow-sm transition outline-none hover:bg-brand-50 focus-visible:ring-4 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {tailoring ? (
            <>
              <Spinner />
              Tailoring…
            </>
          ) : (
            <>
              Tailor Resume
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </>
          )}
        </button>
      </div>
      {tailoring && (
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/25 sm:mt-5" aria-hidden="true">
          <div className="absolute inset-y-0 left-0 w-2/5 animate-indeterminate rounded-full bg-white motion-reduce:w-full motion-reduce:animate-pulse" />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 max-h-32 overflow-y-auto rounded-xl bg-white px-4 py-3 text-sm font-medium text-rose-700 sm:mt-4">
          {error}
        </p>
      )}
    </section>
  );
}

function MatchSummary({
  matched,
  missing,
  projected,
  adding,
  updating,
}: {
  matched: number;
  missing: number;
  /** Keywords and score if the selected skills were added. */
  projected: { matchedKeywords: string[]; missingKeywords: string[]; matchPercent: number };
  adding: number;
  updating: boolean;
}) {
  const total = matched + missing;
  const current = matchPercent(matched, missing);
  const percent = projected.matchPercent;
  const gain = percent - current;
  const level =
    total === 0
      ? { label: "No keywords found", ring: "stroke-neutral-300 dark:stroke-neutral-600", text: "text-neutral-500" }
      : percent >= 75
        ? { label: "Strong match", ring: "stroke-emerald-500", text: "text-emerald-600 dark:text-emerald-400" }
        : percent >= 45
          ? { label: "Partial match", ring: "stroke-amber-500", text: "text-amber-600 dark:text-amber-400" }
          : { label: "Weak match", ring: "stroke-rose-500", text: "text-rose-600 dark:text-rose-400" };

  const toGoal =
    percent < TARGET_PERCENT
      ? skillsToReach(projected.matchedKeywords.length, projected.missingKeywords.length, TARGET_PERCENT)
      : 0;

  const radius = 34;
  const circumference = 2 * Math.PI * radius;

  return (
    <section
      aria-busy={updating || undefined}
      className="flex flex-col gap-6 rounded-3xl border border-neutral-200/80 bg-white px-5 py-6 shadow-sm sm:flex-row sm:items-center sm:px-8 dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <div className="relative size-24 shrink-0">
        <svg viewBox="0 0 80 80" className="size-24 -rotate-90" aria-hidden="true">
          <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="8" className="stroke-neutral-100 dark:stroke-neutral-800" />
          {gain > 0 && (
            // The current score stays visible underneath, so the gain reads as the lighter extra arc.
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - percent / 100)}
              className="stroke-emerald-300 transition-[stroke-dashoffset] duration-700 dark:stroke-emerald-500/50"
            />
          )}
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - current / 100)}
            className={`${level.ring} transition-[stroke-dashoffset] duration-700`}
          />
        </svg>
        <span
          className={`absolute inset-0 grid place-items-center text-xl font-semibold text-neutral-900 dark:text-white ${updating ? "animate-pulse" : ""}`}
        >
          {percent}%
        </span>
      </div>
      <div className="min-w-0">
        <p className={`flex flex-wrap items-center gap-2 text-sm font-semibold tracking-wide uppercase ${level.text}`}>
          {level.label}
          {gain > 0 && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs tracking-normal text-emerald-700 normal-case dark:bg-emerald-500/15 dark:text-emerald-300">
              +{gain}% with {adding} {adding === 1 ? "skill" : "skills"}
            </span>
          )}
        </p>
        <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
          {total === 0
            ? "We couldn't pick out keywords from this posting."
            : gain > 0
              ? `Your resume would cover ${projected.matchedKeywords.length} of ${total} keywords from this job.`
              : `Your resume covers ${matched} of ${total} keywords from this job.`}
        </p>
        {total > 0 && (
          <p className="mt-2 text-sm font-medium" aria-live="polite">
            {toGoal === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">You&apos;re at {TARGET_PERCENT}% or above. Nice work.</span>
            ) : toGoal ? (
              <span className="text-neutral-700 dark:text-neutral-300">
                Click to reach {TARGET_PERCENT}%: pick {toGoal} more missing {toGoal === 1 ? "keyword" : "keywords"} you have.
              </span>
            ) : null}
          </p>
        )}
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Keyword coverage is a rough guide to how screening tools read your resume, not a verdict on your fit.
        </p>
      </div>
    </section>
  );
}

function KeywordCard({
  tone,
  title,
  description,
  keywords,
  empty,
  footer,
  selected,
  onToggle,
  locked = false,
}: {
  tone: "matched" | "missing";
  title: string;
  description: string;
  keywords: string[];
  empty: string;
  footer?: React.ReactNode;
  /** Makes each keyword a toggle button. */
  selected?: string[];
  onToggle?: (keyword: string) => void;
  locked?: boolean;
}) {
  const matched = tone === "matched";
  return (
    <section className="flex flex-col rounded-3xl border border-neutral-200/80 bg-white px-5 py-6 shadow-sm sm:px-7 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            matched
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          }`}
        >
          {keywords.length}
        </span>
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>

      {keywords.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          {empty}
        </p>
      ) : (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label={title}>
          {keywords.map((keyword) =>
            onToggle ? (
              <li key={keyword}>
                <SkillToggle
                  keyword={keyword}
                  on={selected?.includes(keyword) ?? false}
                  onToggle={() => onToggle(keyword)}
                  disabled={locked}
                />
              </li>
            ) : (
            <li
              key={keyword}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${
                matched
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              }`}
            >
              {matched ? (
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              )}
              {keyword}
            </li>
            ),
          )}
        </ul>
      )}
      {footer && <div className="mt-5">{footer}</div>}
    </section>
  );
}

function SkillToggle({
  keyword,
  on,
  onToggle,
  disabled,
}: {
  keyword: string;
  on: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      disabled={disabled}
      title={on ? `Remove ${keyword} from the skills to add` : `Add ${keyword} to your skills`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition outline-none focus-visible:ring-4 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${
        on
          ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-600 focus-visible:ring-emerald-500/30 dark:border-emerald-400 dark:bg-emerald-500"
          : "border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300 hover:bg-rose-100 focus-visible:ring-rose-500/20 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
      }`}
    >
      {on ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
          <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
        </svg>
      )}
      {keyword}
    </button>
  );
}

function SuggestionChecklist({
  bullets,
  resume,
  accepted,
  onAcceptedChange,
  disabled = false,
}: {
  bullets: SuggestedBullet[];
  resume: Resume;
  accepted: string[];
  onAcceptedChange: (ids: string[]) => void;
  /** The selection is being sent; changing it now wouldn't match the generated files. */
  disabled?: boolean;
}) {
  const selected = new Set(accepted);
  const allSelected = bullets.length > 0 && bullets.every((b) => selected.has(b.id));

  function toggle(id: string, on: boolean) {
    onAcceptedChange(on ? [...accepted.filter((x) => x !== id), id] : accepted.filter((x) => x !== id));
  }

  function jobLabel(workExperienceId: string): string | null {
    const job = resume.workExperience.find((w) => w.id === workExperienceId);
    if (!job) return null;
    return [job.jobTitle, job.company].filter(Boolean).join(" · ");
  }

  return (
    <section
      aria-labelledby="suggestions-title"
      className="rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
    >
      <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:border-neutral-800">
        <div>
          <h3 id="suggestions-title" className="text-lg font-semibold text-neutral-900 dark:text-white">
            Suggested bullet improvements
          </h3>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            Rewordings of bullets you already wrote. Tick the ones you want to use.
          </p>
        </div>
        {bullets.length > 0 && (
          <button
            type="button"
            onClick={() => onAcceptedChange(allSelected ? [] : bullets.map((b) => b.id))}
            disabled={disabled}
            className="self-start rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto dark:text-brand-400 dark:hover:bg-brand-500/10"
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
        )}
      </div>

      {bullets.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-neutral-500 sm:px-8 dark:text-neutral-400">
          No changes suggested. Your bullets already read well for this job.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {bullets.map((bullet) => {
            const checked = selected.has(bullet.id);
            const job = jobLabel(bullet.workExperienceId);
            return (
              <li key={bullet.id}>
                <label
                  className={`flex gap-4 px-5 py-5 transition sm:px-8 ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${
                    checked
                      ? "bg-brand-50/60 dark:bg-brand-500/[0.07]"
                      : disabled
                        ? ""
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={checked}
                    onChange={(e) => toggle(bullet.id, e.target.checked)}
                    className="mt-1 size-5 shrink-0 cursor-pointer rounded accent-brand-600 disabled:cursor-not-allowed"
                  />
                  <span className="min-w-0 flex-1">
                    {job && (
                      <span className="text-xs font-semibold tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                        {job}
                      </span>
                    )}
                    <span className="mt-1 block text-[15px] leading-relaxed font-medium text-neutral-900 dark:text-white">
                      {bullet.text}
                    </span>
                    <span className="mt-2 block text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                      <span className="font-medium text-neutral-600 dark:text-neutral-300">Currently: </span>
                      {bullet.originalText}
                    </span>
                    <span className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
                        <path d="M10 1a6 6 0 0 0-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 0 0 .572.729 6.016 6.016 0 0 0 2.856 0A.75.75 0 0 0 12 15.1v-.644c0-1.013.762-1.957 1.815-2.825A6 6 0 0 0 10 1ZM8.863 17.414a.75.75 0 0 0-.226 1.483 9.066 9.066 0 0 0 2.726 0 .75.75 0 0 0-.226-1.483 7.553 7.553 0 0 1-2.274 0Z" />
                      </svg>
                      <span>
                        <span className="font-semibold">Why: </span>
                        {bullet.reason}
                      </span>
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {bullets.length > 0 && (
        <div className="border-t border-neutral-100 px-5 py-4 text-sm text-neutral-500 sm:px-8 dark:border-neutral-800 dark:text-neutral-400" aria-live="polite">
          <span className="font-semibold text-neutral-700 dark:text-neutral-200">
            {accepted.length} of {bullets.length}
          </span>{" "}
          {accepted.length === 1 ? "change" : "changes"} selected.
        </div>
      )}
    </section>
  );
}
