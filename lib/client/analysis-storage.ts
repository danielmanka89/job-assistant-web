import type { GapAnalysisResponse } from "@/lib/types";

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
