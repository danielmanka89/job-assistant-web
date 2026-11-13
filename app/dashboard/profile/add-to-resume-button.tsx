"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile, logout } from "@/lib/client/api";
import { storeResume } from "@/lib/client/resume-storage";
import { Button } from "@/components/ui/button";

/**
 * Opens the latest resume on the Review page to add missing details (visa, pay rate, LinkedIn…).
 * Saving there updates the profile. With no resume yet, goes to Upload instead.
 */
export function AddToResumeButton() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    setOpening(true);
    const result = await getProfile();
    if (!result.ok) {
      setOpening(false);
      if (result.error.code === "UNAUTHORIZED" || result.error.code === "HTTP_401") {
        await logout();
        router.replace("/login");
        return;
      }
      setError(result.error.message);
      return;
    }
    if (!result.data.resume) {
      router.push("/dashboard/upload");
      return;
    }
    storeResume(result.data.resume); // the Review page edits the resume stored for this tab
    router.push("/dashboard/review");
  }

  return (
    <div className="shrink-0">
      <Button type="button" onClick={open} loading={opening} variant="secondary" size="sm">
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
          <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
        </svg>
        Add to your resume
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
