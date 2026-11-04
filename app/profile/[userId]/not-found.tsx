import Link from "next/link";

/** Shown for an unknown link or a portfolio its owner hasn't shared (or made private again). */
export default function PortfolioNotFound() {
  return (
    <main className="grid h-dvh place-items-center bg-white px-6 text-center text-neutral-900 dark:bg-[#0c0c0c] dark:text-white">
      <div className="max-w-md">
        <p className="font-display text-sm font-medium tracking-widest text-brand-600 uppercase dark:text-brand-500">Portfolio</p>
        <h1 className="mt-3 font-display text-4xl font-bold uppercase">This portfolio isn&apos;t public</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          The link may be wrong, or the candidate has made their portfolio private. Ask them for a new link.
        </p>
        <Link href="/" className="mt-8 inline-flex rounded-full bg-brand-600 px-6 py-3 font-display text-sm font-medium tracking-wider text-white uppercase transition hover:bg-brand-700">
          Go to JobAssistant
        </Link>
      </div>
    </main>
  );
}
