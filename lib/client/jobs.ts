import type { JobListResponse, JobPosting } from "@/lib/types";

/** Jobs from a GET /api/jobs body, skipping any malformed entries. */
export function toJobList(body: unknown): JobPosting[] {
  const jobs = (body as Partial<JobListResponse> | null)?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.filter(
    (j): j is JobPosting => !!j && typeof j.id === "string" && typeof j.title === "string" && typeof j.description === "string",
  );
}

/** Only web links are rendered as "Apply"; anything else (e.g. javascript:) is dropped. */
export function safeApplyUrl(url: string | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** Short plain-text preview of a job description, with list markers removed. */
export function descriptionSnippet(text: string, max = 240) {
  // Drop list markers ("- ", "• ") so bullet lists read as sentences.
  const flat = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-•*]\s+/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
  return flat.length > max ? `${flat.slice(0, max).replace(/\s+\S*$/, "")}…` : flat;
}

// Hands the chosen job to the analyze page. Descriptions can be thousands of
// characters, too long to pass in the URL.
const PENDING_KEY = "job-assistant.pending-job";

export type PendingJob = Pick<JobPosting, "id" | "title" | "company" | "description">;

export function storePendingJob(job: PendingJob): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(job));
  } catch {
    // Storage unavailable: the analyze page simply opens empty.
  }
}

export function readPendingJob(): PendingJob | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const job = JSON.parse(raw) as PendingJob;
    return job && typeof job.description === "string" ? job : null;
  } catch {
    return null;
  }
}

export function clearPendingJob(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}
