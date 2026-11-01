import type { GeneratedFile } from "@/lib/types";

// Response shapes for the dashboard endpoints. They live here until Daniel adds
// them to lib/types.ts; the parsers below accept missing fields so the page
// doesn't break if the API sends slightly less.

/** GET /api/dashboard-stats */
export interface DashboardStats {
  resumesUploaded: number;
  resumesTailored: number;
  averageMatchPercent: number | null; // null until a tailored resume has a score
  bestMatchPercent: number | null;
}

/** One entry in GET /api/tailored-resumes ({ tailoredResumes: [...] }, newest first). */
export interface TailoredResumeSummary {
  id: string;
  createdAt: string; // ISO 8601
  jobTitle?: string; // short label for the job, if the API has one
  finalMatchPercent: number | null; // null for resumes tailored before the score was saved
  files: GeneratedFile[];
}

const toCount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
const toPercent = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : null;

export function toDashboardStats(body: unknown): DashboardStats {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    resumesUploaded: toCount(b.resumesUploaded),
    resumesTailored: toCount(b.resumesTailored),
    averageMatchPercent: toPercent(b.averageMatchPercent),
    bestMatchPercent: toPercent(b.bestMatchPercent),
  };
}

function isFile(f: unknown): f is GeneratedFile {
  const v = f as Partial<GeneratedFile> | null;
  return !!v && (v.format === "docx" || v.format === "pdf") && typeof v.downloadUrl === "string";
}

export function toTailoredResumeList(body: unknown): TailoredResumeSummary[] {
  const list = (body as { tailoredResumes?: unknown } | null)?.tailoredResumes;
  if (!Array.isArray(list)) return [];
  return list
    .filter((r): r is Record<string, unknown> => !!r && typeof r.id === "string" && typeof r.createdAt === "string")
    .map((r) => ({
      id: r.id as string,
      createdAt: r.createdAt as string,
      jobTitle: typeof r.jobTitle === "string" && r.jobTitle.trim() ? r.jobTitle.trim() : undefined,
      finalMatchPercent: toPercent(r.finalMatchPercent),
      files: Array.isArray(r.files) ? r.files.filter(isFile) : [],
    }));
}
