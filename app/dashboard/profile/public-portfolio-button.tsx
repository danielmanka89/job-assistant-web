"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiError } from "@/lib/types";
import { getProfile, logout, setPortfolioPublic } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

const isUnauthorized = (e: ApiError) => e.code === "UNAUTHORIZED" || e.code === "HTTP_401";

/**
 * "View Public Portfolio": asks the candidate to approve sharing first, then makes the portfolio
 * public and opens it. Once it's public, the link can be copied or the portfolio made private again.
 */
export function PublicPortfolioButton() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicPath, setPublicPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Shows whether the portfolio is already public (and its link) when the page opens.
  useEffect(() => {
    let live = true;
    getProfile().then((result) => {
      if (live && result.ok && result.data.publishedAt && result.data.resume) setPublicPath(`/profile/${result.data.resume.userId}`);
    });
    return () => {
      live = false;
    };
  }, []);

  async function unauthorized() {
    await logout();
    router.replace("/login");
  }

  async function approve() {
    setError(null);
    setWorking(true);
    const result = await setPortfolioPublic(true);
    if (!result.ok) {
      setWorking(false);
      if (isUnauthorized(result.error)) return unauthorized();
      setError(result.error.message);
      return;
    }
    setPublicPath(result.data.path);
    router.push(result.data.path);
  }

  async function makePrivate() {
    setError(null);
    setWorking(true);
    const result = await setPortfolioPublic(false);
    setWorking(false);
    if (!result.ok) {
      if (isUnauthorized(result.error)) return unauthorized();
      setError(result.error.message);
      return;
    }
    setPublicPath(null);
  }

  async function copyLink() {
    if (!publicPath) return;
    try {
      await navigator.clipboard.writeText(new URL(publicPath, window.location.origin).toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the link. Open your portfolio and copy it from the address bar.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button type="button" onClick={() => setAsking(true)} size="sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" strokeLinejoin="round" />
        </svg>
        View Public Portfolio
      </Button>
      {publicPath && (
        <p className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Public
          </span>
          <button type="button" onClick={copyLink} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button type="button" onClick={makePrivate} disabled={working} className="font-semibold text-neutral-500 hover:text-neutral-800 hover:underline disabled:opacity-60 dark:hover:text-white">
            Make private
          </button>
        </p>
      )}
      {error && !asking && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {asking && (
        <ApproveDialog
          working={working}
          error={error}
          onApprove={approve}
          onCancel={() => {
            setAsking(false);
            setError(null);
          }}
        />
      )}
    </div>
  );
}

/** The approval step. Uses <dialog> for focus trapping; Escape or Cancel closes it without sharing. */
function ApproveDialog({ working, error, onApprove, onCancel }: { working: boolean; error: string | null; onApprove: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby="portfolio-title"
      aria-describedby="portfolio-description"
      onCancel={(e) => {
        e.preventDefault(); // Escape: close through onCancel so state stays in step
        if (!working) onCancel();
      }}
      // Solid colors (not bg-white), so the dashboard's frosted-glass styling leaves this dialog crisp.
      className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-3xl border border-white/70 bg-[#fff] p-0 text-left shadow-2xl shadow-brand-900/20 backdrop:bg-neutral-950/50 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-[#171717]"
    >
      <div className="bg-brand-600 px-6 pt-6 pb-5 text-white sm:px-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" strokeLinejoin="round" />
            </svg>
          </span>
          <h2 id="portfolio-title" className="pt-2 text-xl font-semibold">
            Share your public portfolio?
          </h2>
        </div>
      </div>
      <div className="px-6 py-6 sm:px-8">
        <p id="portfolio-description" className="text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-200">
          This will open your public profile. Any recruiter with this link can see your full details. Do you approve?
        </p>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          It shows your contact details, summary, skills, experience, education and your resume file. Your visa status and pay
          rate stay private. You can make it private again at any time.
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={working}>
            Cancel
          </Button>
          {/* No autoFocus: the dialog starts on Cancel (first in the DOM), so an accidental Enter
              doesn't publish the candidate's details. */}
          <Button type="button" onClick={onApprove} loading={working}>
            {working ? "Sharing…" : "Approve"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
