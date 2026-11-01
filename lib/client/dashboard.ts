import type { DashboardStats, GeneratedFile, TailoredResumeListResponse, TailoredResumeWithFiles } from "@/lib/types";

// Parsers for the dashboard endpoints. They fill in safe defaults so one bad
// field doesn't blank the whole page.

const toCount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

/** A 0-100 score, or null when it's missing (older tailored resumes have none). */
export const toPercent = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : null;

/** Body of GET /api/dashboard-stats. */
export function toDashboardStats(body: unknown): DashboardStats {
  const b = (body ?? {}) as Partial<Record<keyof DashboardStats, unknown>>;
  const jobs = (b.jobs ?? {}) as Partial<Record<keyof DashboardStats["jobs"], unknown>>;
  return {
    tailoredResumeCount: toCount(b.tailoredResumeCount),
    averageMatchPercent: toPercent(b.averageMatchPercent),
    jobs: { total: toCount(jobs.total), native: toCount(jobs.native), external: toCount(jobs.external) },
  };
}

function isFile(f: unknown): f is GeneratedFile {
  const v = f as Partial<GeneratedFile> | null;
  return !!v && (v.format === "docx" || v.format === "pdf") && typeof v.downloadUrl === "string";
}

/** Body of GET /api/tailored-resumes, skipping malformed entries. */
export function toTailoredResumeList(body: unknown): TailoredResumeWithFiles[] {
  const list = (body as Partial<TailoredResumeListResponse> | null)?.tailoredResumes;
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => !!r && typeof r.id === "string" && typeof r.createdAt === "string")
    .map((r) => ({
      ...r,
      finalMatchPercent: toPercent(r.finalMatchPercent),
      files: Array.isArray(r.files) ? r.files.filter(isFile) : [],
    }));
}
