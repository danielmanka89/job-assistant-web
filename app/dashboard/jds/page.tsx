import type { Metadata } from "next";
import { JdsView } from "./jds-view";

export const metadata: Metadata = { title: "My JDs" };

/** ?send=<jd id> opens that JD's Send panel (the download page links here after tailoring from My JDs). */
export default async function JdsPage({ searchParams }: { searchParams: Promise<{ send?: string | string[] }> }) {
  const { send } = await searchParams;
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">My JDs</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Job descriptions vendors send you directly, kept apart from the Job Board. Save one, tailor your resume to it, and send it back.
        </p>
      </div>
      <JdsView initialSendId={typeof send === "string" && send.length <= 100 ? send : null} />
    </main>
  );
}
