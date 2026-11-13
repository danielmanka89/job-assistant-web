"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { openHelpAssistant } from "@/components/help/help-assistant";
import { HELP_CATEGORIES, searchHelp, type HelpArticle, type HelpCategory } from "@/lib/help-content";

// Settings › Help Center: every how-to guide, searchable and grouped by topic, with a shortcut to the
// help assistant for anything the guides don't answer.

export function HelpCenter() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory | "All">("All");
  const searchId = useId();
  const titleId = useId();

  const results = useMemo(() => {
    const found = searchHelp(query);
    return category === "All" ? found : found.filter((a) => a.category === category);
  }, [query, category]);

  // Grouped by topic when browsing; one list in relevance order while searching.
  const groups: { label: string; articles: HelpArticle[] }[] = query.trim()
    ? [{ label: `${results.length} ${results.length === 1 ? "result" : "results"}`, articles: results }]
    : HELP_CATEGORIES.map((c) => ({ label: c, articles: results.filter((a) => a.category === c) })).filter((g) => g.articles.length);

  return (
    <section aria-labelledby={titleId} className="mt-6 rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-start gap-4 border-b border-neutral-100 px-5 py-5 sm:px-8 dark:border-neutral-800">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.4v.5" strokeLinecap="round" />
            <circle cx="12" cy="16.6" r=".6" fill="currentColor" />
          </svg>
        </span>
        <div className="min-w-0 flex-[999_1_14rem]">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
            Help Center
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">How every part of JobAssistant works. Can&apos;t find it? Ask the assistant by text or voice.</p>
        </div>
        <button
          type="button"
          onClick={() => openHelpAssistant()}
          className="flex-[1_0_auto] rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none sm:flex-none"
        >
          Ask the assistant
        </button>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-8">
        <div className="space-y-3">
          <label htmlFor={searchId} className="sr-only">
            Search help
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help, e.g. “download Excel” or “dark mode”"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
          />
          <div role="group" aria-label="Topic" className="flex flex-wrap gap-1.5">
            {(["All", ...HELP_CATEGORIES] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none ${
                  category === c
                    ? "bg-brand-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Says how many guides match as you type or change topic. */}
        <p role="status" className="sr-only">
          {query.trim() || category !== "All" ? `${results.length} ${results.length === 1 ? "guide" : "guides"} found` : ""}
        </p>

        {results.length === 0 ? (
          <div className="rounded-2xl bg-neutral-50 px-4 py-6 text-center dark:bg-neutral-900">
            <p className="text-sm text-neutral-600 dark:text-neutral-300">No guide matches that.</p>
            <button
              type="button"
              onClick={() => openHelpAssistant(query.trim() || undefined)}
              className="mt-3 rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none dark:border-brand-500/30 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              {query.trim() ? `Ask the assistant: “${query.trim()}”` : "Ask the assistant"}
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <h3 className="pb-2 text-xs font-bold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">{group.label}</h3>
              <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200/80 dark:divide-neutral-800 dark:border-neutral-800">
                {group.articles.map((article) => (
                  <li key={article.id}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold text-neutral-900 marker:hidden focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none focus-visible:ring-inset dark:text-white [&::-webkit-details-marker]:hidden">
                        <span className="flex-1">{article.title}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0 text-neutral-400 transition group-open:rotate-180" aria-hidden="true">
                          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                        {article.body.map((line, i) => (
                          <p key={i} className={/^\d+\./.test(line) ? "pl-4" : undefined}>
                            {line}
                          </p>
                        ))}
                        {article.href && (
                          <Link
                            href={article.href}
                            className="inline-block pt-1 text-sm font-semibold text-brand-700 hover:underline focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-brand-300"
                          >
                            Go there<span aria-hidden="true"> →</span>
                            <span className="sr-only">: {article.title}</span>
                          </Link>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
