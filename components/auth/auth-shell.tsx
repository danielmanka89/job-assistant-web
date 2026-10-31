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
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_10%_-10%,rgba(99,102,241,0.55),transparent),radial-gradient(40rem_30rem_at_110%_110%,rgba(217,70,239,0.45),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <Logo light />
          <div className="max-w-md">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
              Tailor your resume to every job in minutes.
            </h2>
            <ul className="mt-10 space-y-6">
              {highlights.map((h) => (
                <li key={h.title} className="flex gap-4">
                  <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 text-indigo-200" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-white">{h.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">{h.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-slate-400">Your experience, your words, matched to the role.</p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center bg-slate-50 px-4 py-10 sm:px-8 dark:bg-slate-950">
        <div className="mx-auto w-full max-w-md">
          <Logo className="mb-10 lg:hidden" />
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-9 dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
            <p className="mt-1.5 text-[15px] text-slate-500 dark:text-slate-400">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">{footer}</p>
        </div>
      </main>
    </div>
  );
}
