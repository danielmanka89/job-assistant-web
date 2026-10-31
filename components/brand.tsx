import Link from "next/link";

export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid size-10 place-items-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 ring-4 ring-brand-600/15">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
          <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span
        className={`font-display text-xl font-semibold uppercase leading-none tracking-wide ${
          light ? "text-white" : "text-neutral-900 dark:text-white"
        }`}
      >
        Job<span className="text-brand-600 dark:text-brand-500">Assistant</span>
      </span>
    </Link>
  );
}
