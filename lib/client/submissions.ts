import type { CreateSubmissionResponse, SheetValues, Submission, SubmissionListResponse } from "@/lib/types";

// Parsers for the submissions endpoints. A malformed cell becomes blank instead of breaking the sheet.

function toSheetValues(value: unknown): SheetValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** One submission from an API body, or null if it has no id. */
export function toSubmission(body: unknown): Submission | null {
  const b = body as Partial<Record<keyof Submission, unknown>> | null;
  if (!b || typeof b.id !== "string") return null;
  return {
    id: b.id,
    jobId: typeof b.jobId === "string" ? b.jobId : null,
    vendor: toSheetValues(b.vendor),
    submission: toSheetValues(b.submission),
    skills: toSheetValues(b.skills),
    client: toSheetValues(b.client),
    createdAt: typeof b.createdAt === "string" ? b.createdAt : "",
    updatedAt: typeof b.updatedAt === "string" ? b.updatedAt : "",
  };
}

/** Body of GET /api/submissions, skipping malformed rows. */
export function toSubmissionList(body: unknown): Submission[] {
  const list = (body as Partial<SubmissionListResponse> | null)?.submissions;
  return Array.isArray(list) ? list.map(toSubmission).filter((s): s is Submission => s !== null) : [];
}

/** Body of POST /api/submissions, or null if it has no usable submission. */
export function toCreateSubmissionResponse(body: unknown): CreateSubmissionResponse | null {
  const b = body as Partial<Record<keyof CreateSubmissionResponse, unknown>> | null;
  const submission = toSubmission(b?.submission);
  return submission ? { submission, created: b?.created !== false } : null;
}
