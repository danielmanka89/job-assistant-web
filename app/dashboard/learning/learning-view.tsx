"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ApiError, LearningInsights, LearningPath, LearningStatus } from "@/lib/types";
import { learningContent, type LearningCard } from "@/lib/learning-content";
import { getLearningInsights, logout, removeLearningPath, startLearning, updateLearningPath } from "@/lib/client/api";
import { ErrorAlert } from "@/components/ui/alert";
import { Gauge } from "@/components/ui/gauge";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: LearningInsights };

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

const STATUS_LABEL: Record<LearningStatus, string> = { interested: "Interested", in_progress: "In progress", completed: "Completed" };
const STATUS_STYLE: Record<LearningStatus, string> = {
  interested: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};

/** The user's learning paths as tabs; each shows a roadmap they can tick off and learning resources. */
export function LearningView() {
  const router = useRouter();
  const params = useSearchParams();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getLearningInsights().then(async (result) => {
      if (!live) return;
      if (!result.ok && isUnauthorized(result.error)) {
        await logout();
        router.replace("/login");
        return;
      }
      setLoad(result.ok ? { status: "ready", data: result.data } : { status: "error", message: result.error.message });
    });
    return () => {
      live = false;
    };
  }, [router]);

  async function handle<T>(result: { ok: true; data: T } | { ok: false; error: ApiError }): Promise<T | null> {
    if (result.ok) return result.data;
    if (isUnauthorized(result.error)) {
      await logout();
      router.replace("/login");
    } else setError(result.error.message);
    return null;
  }

  const setPaths = (update: (paths: LearningPath[]) => LearningPath[]) =>
    setLoad((l) => (l.status === "ready" ? { status: "ready", data: { ...l.data, paths: update(l.data.paths) } } : l));

  async function add(skill: string) {
    setError(null);
    setBusy(true);
    const paths = await handle(await startLearning([skill]));
    setBusy(false);
    if (paths) {
      setPaths(() => paths);
      setPicked(skill);
    }
  }

  async function update(path: LearningPath, changes: { completedSteps?: string[]; status?: LearningStatus }) {
    setError(null);
    setPaths((ps) => ps.map((p) => (p.id === path.id ? { ...p, ...changes } : p))); // show the tick straight away
    const saved = await handle(await updateLearningPath(path.id, changes));
    setPaths((ps) => ps.map((p) => (p.id === path.id ? (saved ?? path) : p)));
  }

  async function remove(path: LearningPath) {
    if (!window.confirm(`Stop following the ${path.skillName} learning path? Your progress will be lost.`)) return;
    setError(null);
    setPaths((ps) => ps.filter((p) => p.id !== path.id));
    if ((await handle(await removeLearningPath(path.id))) === null) setPaths((ps) => [...ps, path]);
    setPicked(null);
  }

  if (load.status === "loading") {
    return <div className="h-96 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-900" aria-busy="true" aria-label="Loading your learning paths" />;
  }
  if (load.status === "error") return <ErrorAlert>{load.message}</ErrorAlert>;

  const { data } = load;
  const fromLink = params.get("skill");
  const active = data.paths.find((p) => p.skillName === (picked ?? fromLink)) ?? data.paths[0] ?? null;
  const suggestions = data.missingSkills.filter((m) => !data.paths.some((p) => p.skillName === m.skill));

  return (
    <div className="space-y-6">
      {data.hasResume && (
        <div className="flex flex-col gap-5 rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-900/60">
          <Gauge percent={data.marketReachPercent} size={96} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-neutral-900 dark:text-white">Market Reach: {data.marketReachPercent}%</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              Add a skill to your resume once you&apos;ve learned it, then upload it again. Your Market Reach updates from
              your resume.
            </p>
          </div>
          <Link href="/dashboard/profile" className="shrink-0 text-sm font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
            Back to My Profile
          </Link>
        </div>
      )}

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {suggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">Suggested from your resume</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((m) => (
              <li key={m.skill}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => add(m.skill)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand-300 px-3.5 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-60 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-500/10"
                >
                  <span aria-hidden="true">+</span> Learn {m.skill}
                  <span className="font-normal text-emerald-700 dark:text-emerald-400">+{m.gainPercent}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!active ? (
        <div className="rounded-3xl border border-dashed border-neutral-300 px-6 py-14 text-center dark:border-neutral-700">
          <p className="font-semibold text-neutral-900 dark:text-white">No learning paths yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
            {data.hasResume ? "Pick a suggested skill above to get a roadmap." : "Upload your resume to see which skills would reach more employers."}
          </p>
          {!data.hasResume && (
            <Link href="/dashboard/upload" className="mt-6 inline-block font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
              Upload resume
            </Link>
          )}
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Your learning paths" className="flex gap-1 overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
            {data.paths.map((p) => {
              const selected = p.id === active.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="learning-panel"
                  onClick={() => setPicked(p.skillName)}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 ${
                    selected ? "bg-brand-600 text-white shadow-md shadow-brand-600/25" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  {p.skillName}
                  <span className={`ml-2 text-xs ${selected ? "text-white/80" : "text-neutral-400"}`}>{p.progress}%</span>
                </button>
              );
            })}
          </div>
          <SkillPanel key={active.id} path={active} onUpdate={(changes) => update(active, changes)} onRemove={() => remove(active)} />
        </>
      )}
    </div>
  );
}

const SECTIONS = [
  { id: "roadmap", label: "Roadmap" },
  { id: "lessons", label: "Lessons" },
  { id: "certifications", label: "Certifications" },
  { id: "practice", label: "Coding Practice" },
  { id: "challenges", label: "Coding Challenges" },
  { id: "presentations", label: "Presentations" },
] as const;

function SkillPanel({
  path,
  onUpdate,
  onRemove,
}: {
  path: LearningPath;
  onUpdate: (changes: { completedSteps?: string[]; status?: LearningStatus }) => void;
  onRemove: () => void;
}) {
  const content = learningContent(path.skillName);
  const done = new Set(path.completedSteps);
  const toggle = (id: string) => onUpdate({ completedSteps: done.has(id) ? path.completedSteps.filter((s) => s !== id) : [...path.completedSteps, id] });

  return (
    <div id="learning-panel" role="tabpanel" className="space-y-6">
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">Learn {path.skillName}</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {path.completedSteps.length} of {content.roadmap.length} roadmap steps done
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[path.status]}`}>{STATUS_LABEL[path.status]}</span>
            <button type="button" onClick={onRemove} className="text-sm font-medium text-neutral-500 underline-offset-2 hover:text-rose-600 hover:underline">
              Remove
            </button>
          </div>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={path.progress}
          aria-label={`${path.skillName} progress`}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-[width] duration-500" style={{ width: `${path.progress}%` }} />
        </div>
        <nav aria-label="Sections" className="mt-5 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-700 transition hover:bg-brand-50 hover:text-brand-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-brand-500/10 dark:hover:text-brand-300">
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="roadmap" title="Roadmap" note="Tick each step as you finish it.">
        <ol className="space-y-3">
          {content.roadmap.map((step, i) => {
            const checked = done.has(step.id);
            return (
              <li key={step.id}>
                <label className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ${checked ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(step.id)} className="mt-1 size-4 shrink-0 accent-brand-600" />
                  <span>
                    <span className="block text-xs font-semibold tracking-wider text-neutral-400 uppercase">Step {i + 1}</span>
                    <span className={`block font-semibold ${checked ? "text-neutral-500 line-through dark:text-neutral-400" : "text-neutral-900 dark:text-white"}`}>{step.title}</span>
                    <span className="mt-0.5 block text-sm text-neutral-600 dark:text-neutral-300">{step.detail}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ol>
        {path.status === "completed" && (
          <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Done! Add {path.skillName} to your resume and{" "}
            <Link href="/dashboard/upload" className="underline underline-offset-2">
              upload it again
            </Link>{" "}
            to raise your Market Reach.
          </p>
        )}
      </Section>

      <Section id="lessons" title="Lessons" placeholder>
        <Cards cards={content.lessons} />
      </Section>
      <Section id="certifications" title="Certifications" placeholder>
        <Cards cards={content.certifications} />
      </Section>
      <Section id="practice" title="Coding Practice" placeholder>
        <Cards cards={content.practice} />
      </Section>
      <Section id="challenges" title="Coding Challenges" placeholder>
        <Cards cards={content.challenges} />
      </Section>
      <Section id="presentations" title="Presentations" placeholder>
        <Cards cards={content.presentations} />
      </Section>
    </div>
  );
}

function Section({ id, title, note, placeholder = false, children }: { id: string; title: string; note?: string; placeholder?: boolean; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${id}-title`} className="text-xl font-semibold text-neutral-900 uppercase dark:text-white">
          {title}
        </h3>
        {placeholder && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Suggested links · courses coming soon
          </span>
        )}
      </div>
      {note && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Cards({ cards }: { cards: LearningCard[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <li key={card.title}>
          <a
            href={card.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full flex-col rounded-2xl border border-neutral-200 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-neutral-800 dark:hover:border-brand-500/40"
          >
            <span className="text-xs font-semibold tracking-wider text-brand-700 uppercase dark:text-brand-300">{card.source}</span>
            <span className="mt-1 font-semibold text-neutral-900 group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">{card.title}</span>
            <span className="mt-auto pt-3 text-sm text-neutral-500 dark:text-neutral-400">{card.meta}</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
