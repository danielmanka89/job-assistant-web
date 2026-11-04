import type { ReactNode } from "react";
import { Logo } from "@/components/brand";

const highlights = [
  {
    title: "See what's missing",
    body: "Compare your resume to any job description and spot the keywords you're not covering.",
  },
  {
    title: "You stay in control",
    body: "Suggestions only reword what you've already written. Nothing is added unless you pick it.",
  },
  {
    title: "Ready to send",
    body: "Download your tailored resume as .docx or .pdf in one click.",
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    // Neon look: always dark here (data-theme="dark" turns on every dark: style inside), with glowing
    // outlines and text in the theme color (see .neon-auth in globals.css).
    <div data-theme="dark" className="neon-auth relative isolate grid min-h-dvh overflow-hidden bg-[#05060d] text-white lg:grid-cols-[1.05fr_1fr]">
      {/* Glows and a neon grid floor across the whole page. */}
      <div
        className="mono-grayscale pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55rem_38rem_at_8%_-8%,rgb(var(--brand-glow)/0.45),transparent),radial-gradient(45rem_32rem_at_105%_105%,rgb(var(--brand-glow)/0.35),transparent),radial-gradient(30rem_20rem_at_70%_30%,rgb(168_85_247/0.18),transparent)]"
        aria-hidden="true"
      />
      <div className="neon-grid pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[55%]" aria-hidden="true" />

      {/* Brand panel */}
      <aside className="theme-on-dark relative hidden overflow-hidden lg:block">
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Logo light />
          <div className="max-w-md">
            <h2 className="text-5xl font-semibold leading-[1.05] text-white xl:text-6xl">
              Tailor your resume to <span className="neon-text animate-neon-flicker text-brand-400 motion-reduce:animate-none">every job</span> in minutes.
            </h2>
            <ul className="mt-10 space-y-6">
              {highlights.map((h) => (
                <li key={h.title} className="flex gap-4">
                  <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-brand-500/15 shadow-[0_0_12px_rgb(var(--brand-glow)/0.6)] ring-1 ring-brand-400/70">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 text-brand-200" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-white">{h.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-300">{h.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-neutral-400">Your experience, your words, matched to the role.</p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <Logo light className="mb-10 lg:hidden" />
          <div className="neon-card rounded-3xl p-6 sm:p-9">
            <h1 className="neon-text text-2xl font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-1.5 text-[15px] text-neutral-500 dark:text-neutral-400">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
          <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">{footer}</p>
        </div>
      </main>
    </div>
  );
}
