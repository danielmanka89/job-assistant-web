// Frontend shape for GET /api/jobs until a Job type is added to lib/types.ts.
// When it lands there, import it from "@/lib/types" and delete this interface.
export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string; // full plain-text job description
  employmentType?: string; // e.g. "Full-time"
  url?: string; // link to the original posting
  postedAt?: string; // ISO 8601
}

/** Accepts either a plain array or { jobs: [...] } so either response shape works. */
export function toJobList(body: unknown): JobPosting[] {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { jobs?: unknown }).jobs)
      ? (body as { jobs: unknown[] }).jobs
      : [];
  return list.filter(
    (j): j is JobPosting =>
      !!j && typeof j === "object" && typeof (j as JobPosting).id === "string" && typeof (j as JobPosting).description === "string",
  );
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
