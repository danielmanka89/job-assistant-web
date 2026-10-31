import type { Resume } from "@/lib/types";

// Holds the most recently uploaded resume for this browser tab, so the review
// page can load it until there is an endpoint to fetch a resume by id.
const KEY = "job-assistant.current-resume";

export function storeResume(resume: Resume): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(resume));
  } catch {
    // Storage can be unavailable (private mode, quota). The review page shows an empty state then.
  }
}

/** Raw stored JSON, or null if nothing is stored. */
export function readStoredResumeRaw(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parseStoredResume(raw: string | null): Resume | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Resume;
    return value && typeof value === "object" && value.contact ? value : null;
  } catch {
    return null;
  }
}

export function subscribeToStoredResume(onChange: () => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
