import type { GapAnalysisResponse, TailoredResumeResponse } from "@/lib/types";

// Keeps the latest gap analysis for this tab so the download step can build
// the tailored resume from the bullets the user accepted.
const KEY = "job-assistant.current-analysis";

export interface StoredAnalysis {
  resumeId: string;
  jobDescription: string;
  analysis: GapAnalysisResponse;
  acceptedBulletIds: string[];
}

export function storeAnalysis(value: StoredAnalysis): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota). The page still works for this visit.
  }
}

export function readStoredAnalysis(): StoredAnalysis | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredAnalysis;
    return value && value.analysis && Array.isArray(value.acceptedBulletIds) ? value : null;
  } catch {
    return null;
  }
}

// The response from POST /api/tailor, handed from the job match page to the download page.
const TAILORED_KEY = "job-assistant.current-tailored";

export interface StoredTailoring {
  resumeId: string;
  gapAnalysisId: string;
  response: TailoredResumeResponse;
}

export function storeTailoring(value: StoredTailoring): void {
  try {
    sessionStorage.setItem(TAILORED_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable: the download page will ask the user to tailor again.
  }
}

export function readStoredTailoring(): StoredTailoring | null {
  try {
    const raw = sessionStorage.getItem(TAILORED_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredTailoring;
    return value?.response?.tailoredResume && Array.isArray(value.response.files) ? value : null;
  } catch {
    return null;
  }
}
