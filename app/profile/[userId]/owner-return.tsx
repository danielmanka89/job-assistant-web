"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PROFILE = "/dashboard/profile";

/**
 * Shown only to the portfolio's owner (signed in): a "Back to My Profile" button, and a click on any
 * empty part of the page, or Escape, goes back too. Links and buttons keep working, and selecting
 * text (to copy an email, say) doesn't navigate. Recruiters never see any of this.
 */
export function OwnerReturn() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(PROFILE);
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      // Cards (section) and the phone card row (role=region) aren't "empty": tapping one to read it, or
      // while swiping through them, shouldn't leave the page.
      if (target?.closest("a, button, input, select, textarea, label, section, [role=button], [role=region], [data-no-return]")) return;
      if (window.getSelection()?.toString()) return;
      router.push(PROFILE);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(PROFILE);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [router]);

  return (
    <div className="fixed top-4 left-4 z-40 flex items-center gap-3 sm:top-5 sm:left-6">
      <Link
        href={PROFILE}
        aria-label="Back to My Profile"
        className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 p-2.5 sm:py-2 sm:pr-4 sm:pl-3 text-sm font-semibold text-brand-700 shadow-lg shadow-brand-600/10 backdrop-blur-md transition hover:bg-white focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none dark:border-white/10 dark:bg-neutral-900/80 dark:text-brand-300 dark:hover:bg-neutral-900"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.61l3.72 3.72a.75.75 0 1 1-1.06 1.06l-5-5a.75.75 0 0 1 0-1.06l5-5a.75.75 0 1 1 1.06 1.06L5.61 9.25h10.64A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        {/* Just the arrow on phones, so it doesn't cover the big title. */}
        <span className="hidden sm:inline">Back to My Profile</span>
      </Link>
      <span className="hidden text-xs text-neutral-500 lg:inline dark:text-neutral-400">or click anywhere · Esc</span>
    </div>
  );
}
