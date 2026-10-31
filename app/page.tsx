import Link from "next/link";
import { Logo } from "@/components/brand";

export default function Home() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_35rem_at_50%_-10%,rgba(99,102,241,0.45),transparent),radial-gradient(35rem_25rem_at_90%_100%,rgba(217,70,239,0.3),transparent)]" />
      <header className="relative mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo light />
        <Link href="/login" className="text-sm font-semibold text-slate-300 transition hover:text-white">
          Sign in
        </Link>
      </header>

      <main className="relative mx-auto flex max-w-3xl flex-col items-center px-4 pb-24 pt-16 text-center sm:px-6 sm:pt-28">
        <span className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-xs font-medium text-indigo-200">
          Resume tailoring, without making things up
        </span>
        <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">
          Match your resume to the job you actually want.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
          Paste a job description, see which keywords you&apos;re missing, and pick the reworded bullets you like. Then
          download it as .docx or .pdf.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-xl bg-white px-6 py-3 text-[15px] font-semibold text-slate-900 shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-50"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-white/15 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-white/10"
          >
            I already have an account
          </Link>
        </div>
      </main>
    </div>
  );
}
