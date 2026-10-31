"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Resume } from "@/lib/types";
import { USE_MOCK_API } from "./api";
import { sampleResume } from "./mock";
import { parseStoredResume, readStoredResumeRaw, subscribeToStoredResume } from "./resume-storage";

/**
 * The resume stored in this tab. `undefined` while rendering on the server,
 * `null` when nothing is stored. Mock mode falls back to the sample resume.
 */
export function useStoredResume(): Resume | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribeToStoredResume,
    readStoredResumeRaw,
    () => undefined,
  );

  return useMemo(() => {
    if (raw === undefined) return undefined;
    return parseStoredResume(raw) ?? (USE_MOCK_API ? sampleResume() : null);
  }, [raw]);
}
