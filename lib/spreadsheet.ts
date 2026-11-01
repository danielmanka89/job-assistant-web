// The Spreadsheet page's sheets and columns, shared by the API, the page and the Excel export
// (no server-only imports). Cells are plain text; "date" cells hold "YYYY-MM-DD".

import type { JobPosting, ProfileValues, Resume, SheetKey, SheetValues, Submission } from "@/lib/types";
import { withProfile } from "@/lib/profile";
import { scoreText } from "@/lib/skills";

export type ColumnType = "text" | "date" | "select" | "long";

export interface Column {
  key: string;
  label: string;
  type?: ColumnType; // default "text"
  options?: readonly string[]; // for "select"
  width?: number; // Excel column width in characters; default 18
}

export interface Sheet {
  key: SheetKey;
  title: string;
  columns: readonly Column[];
}

export const EMPLOYMENT_TYPES = ["W2", "C2C", "1099", "Full-time", "Contract-to-hire"] as const;

export const SUBMISSION_STATUSES = [
  "Applied",
  "Submitted to vendor",
  "Submitted to client",
  "Interview scheduled",
  "Interviewed",
  "Offer",
  "Placed",
  "Rejected",
  "On hold",
  "Withdrawn",
] as const;

export const SHEETS: readonly Sheet[] = [
  {
    key: "vendor",
    title: "Vendor Information",
    columns: [
      { key: "vendorCompany", label: "Vendor Company", width: 24 },
      { key: "vendorType", label: "Vendor Type", type: "select", options: ["Prime vendor", "Implementation partner", "Sub-vendor", "Direct client"] },
      { key: "contactName", label: "Contact Name", width: 22 },
      { key: "contactTitle", label: "Contact Title", width: 22 },
      { key: "contactEmail", label: "Contact Email", width: 28 },
      { key: "contactPhone", label: "Contact Phone" },
      { key: "vendorRate", label: "Vendor Rate", width: 14 },
      { key: "paymentTerms", label: "Payment Terms" },
      { key: "notes", label: "Notes", type: "long", width: 32 },
    ],
  },
  {
    key: "submission",
    title: "Submission Details",
    columns: [
      { key: "submittedOn", label: "Submission Date", type: "date", width: 16 },
      { key: "status", label: "Status", type: "select", options: SUBMISSION_STATUSES, width: 20 },
      { key: "candidateName", label: "Candidate Name", width: 22 },
      { key: "candidateEmail", label: "Candidate Email", width: 28 },
      { key: "candidatePhone", label: "Candidate Phone" },
      { key: "candidateLocation", label: "Candidate Location", width: 22 },
      { key: "jobTitle", label: "Job Title", width: 28 },
      { key: "jobReference", label: "Job ID / Req #" },
      { key: "jobLocation", label: "Job Location", width: 24 },
      { key: "workMode", label: "Work Mode", type: "select", options: ["Onsite", "Hybrid", "Remote"], width: 12 },
      { key: "employmentType", label: "Employment Type", type: "select", options: EMPLOYMENT_TYPES },
      { key: "rate", label: "Rate / Salary", width: 16 },
      { key: "workAuthorization", label: "Work Authorization", width: 20 },
      { key: "availability", label: "Availability" },
      { key: "interviewDate", label: "Interview Date", type: "date", width: 16 },
      { key: "applyUrl", label: "Apply Link", width: 36 },
      { key: "notes", label: "Notes", type: "long", width: 32 },
    ],
  },
  {
    key: "skills",
    title: "Skill Matrix",
    columns: [
      { key: "requiredSkills", label: "Required Skills", type: "long", width: 36 },
      { key: "candidateSkills", label: "Candidate Skills", type: "long", width: 36 },
      { key: "matchingSkills", label: "Matching Skills", type: "long", width: 30 },
      { key: "missingSkills", label: "Missing Skills", type: "long", width: 30 },
      { key: "matchPercent", label: "Match %", width: 10 },
      { key: "totalExperience", label: "Total Experience (yrs)", width: 20 },
      { key: "relevantExperience", label: "Relevant Experience (yrs)", width: 22 },
      { key: "certifications", label: "Certifications", type: "long", width: 28 },
      { key: "education", label: "Highest Education", width: 28 },
      { key: "notes", label: "Notes", type: "long", width: 32 },
    ],
  },
  {
    key: "client",
    title: "Client Information",
    columns: [
      { key: "clientCompany", label: "Client Company", width: 24 },
      { key: "endClient", label: "End Client", width: 22 },
      { key: "clientLocation", label: "Client Location", width: 24 },
      { key: "industry", label: "Industry" },
      { key: "hiringManager", label: "Hiring Manager", width: 22 },
      { key: "managerEmail", label: "Manager Email", width: 28 },
      { key: "managerPhone", label: "Manager Phone" },
      { key: "projectDuration", label: "Project Duration" },
      { key: "notes", label: "Notes", type: "long", width: 32 },
    ],
  },
];

export const SHEET_KEYS: readonly SheetKey[] = SHEETS.map((s) => s.key);

export const MAX_CELL_CHARS = 2000;

/** Every row is labelled by its job and client, so rows line up across the four sheets. */
export function rowLabel(row: Pick<Submission, "submission" | "client">): { title: string; company: string } {
  return { title: row.submission.jobTitle?.trim() || "Untitled submission", company: row.client.clientCompany?.trim() || "" };
}

/**
 * Checks cells for one sheet: known column, text, length, select options and date format.
 * Returns an error per bad cell (keyed "sheet.column"), or the trimmed values.
 */
export function validateSheetValues(
  sheet: Sheet,
  input: unknown,
): { values: SheetValues; fieldErrors: Record<string, string> } {
  const values: SheetValues = {};
  const fieldErrors: Record<string, string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fieldErrors[sheet.key] = "Must be an object of column -> text";
    return { values, fieldErrors };
  }
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const path = `${sheet.key}.${key}`;
    const column = sheet.columns.find((c) => c.key === key);
    if (!column) fieldErrors[path] = "Unknown column";
    else if (typeof raw !== "string") fieldErrors[path] = "Must be text";
    else {
      const value = raw.trim();
      if (value.length > MAX_CELL_CHARS) fieldErrors[path] = `Must be ${MAX_CELL_CHARS} characters or fewer`;
      else if (value && column.type === "select" && !column.options?.includes(value)) {
        fieldErrors[path] = `Use one of: ${column.options?.join(", ")}`;
      } else if (value && column.type === "date" && !isIsoDate(value)) fieldErrors[path] = "Use a date like 2026-11-01";
      else values[key] = value;
    }
  }
  return { values, fieldErrors };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** The date as "YYYY-MM-DD" (UTC). */
export function isoDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Years of experience across the resume's jobs, counting overlapping jobs once. One decimal place. */
export function yearsOfExperience(resume: Pick<Resume, "workExperience">, now = new Date()): number | null {
  const toMonth = (ym: string | null) => {
    if (!ym) return now.getUTCFullYear() * 12 + now.getUTCMonth();
    const [y, m] = ym.split("-").map(Number);
    return Number.isFinite(y) && Number.isFinite(m) ? y * 12 + (m - 1) : null;
  };
  const spans = resume.workExperience
    .map((job) => [toMonth(job.startDate), toMonth(job.endDate)] as const)
    .filter((s): s is readonly [number, number] => s[0] !== null && s[1] !== null && s[1] >= s[0])
    .sort((a, b) => a[0] - b[0]);
  if (!spans.length) return null;
  let months = 0;
  let [start, end] = spans[0];
  for (const [s, e] of spans.slice(1)) {
    if (s <= end) end = Math.max(end, e);
    else {
      months += end - start;
      [start, end] = [s, e];
    }
  }
  months += end - start;
  return Math.round((months / 12) * 10) / 10;
}

function workMode(location: string): string {
  const l = location.toLowerCase();
  if (l.includes("remote")) return "Remote";
  if (l.includes("hybrid")) return "Hybrid";
  return "";
}

/**
 * The cells a new submission starts with when the user clicks Apply: the job, the candidate from
 * their profile and latest resume (profile fields win), and the keywords from their latest
 * gap analysis of this job, if any. Vendor details aren't known yet and start blank.
 */
export function prefillSubmission(
  job: Pick<JobPosting, "title" | "company" | "location" | "description" | "applyUrl">,
  resume: Pick<Resume, "contact" | "skills" | "workExperience" | "education"> | null,
  analysis: { matchedKeywords: string[]; missingKeywords: string[] } | null,
  profile: ProfileValues = {},
  now = new Date(),
): Pick<Submission, SheetKey> {
  const list = (items: string[]) => items.join(", ");
  const blank: Pick<Resume, "contact" | "skills"> = { contact: { fullName: "", email: "" }, skills: [] };
  const candidate = withProfile(resume ?? blank, profile);

  const skills: SheetValues = {};
  if (candidate.skills.length) skills.candidateSkills = list(candidate.skills);
  const years = resume ? yearsOfExperience(resume, now) : null;
  if (years !== null) skills.totalExperience = String(years);
  const degree = resume?.education[0];
  const education = profile.education || (degree ? [degree.degree, degree.fieldOfStudy, degree.institution].filter(Boolean).join(", ") : "");
  if (education) skills.education = education;
  if (analysis) {
    const required = [...analysis.matchedKeywords, ...analysis.missingKeywords];
    // Re-score against the candidate's current skills: some may have been added since the analysis.
    const match = candidate.skills.length ? scoreText(required, list(candidate.skills)) : null;
    skills.requiredSkills = list(required);
    skills.matchingSkills = list(match?.matchedKeywords ?? analysis.matchedKeywords);
    skills.missingSkills = list(match?.missingKeywords ?? analysis.missingKeywords);
    if (match && required.length) skills.matchPercent = `${match.matchPercent}%`;
  } else if (candidate.skills.length) {
    // Without an analysis we only know which of the candidate's skills the job mentions.
    skills.matchingSkills = list(scoreText(candidate.skills, job.description).matchedKeywords);
  }

  const contact = candidate.contact;
  const submission: SheetValues = {
    submittedOn: isoDate(now),
    status: "Applied",
    candidateName: contact.fullName,
    candidateEmail: contact.email,
    candidatePhone: contact.phone ?? "",
    candidateLocation: contact.location ?? "",
    jobTitle: job.title,
    jobLocation: job.location,
    workMode: workMode(job.location),
    applyUrl: job.applyUrl,
  };
  return {
    vendor: {},
    submission: Object.fromEntries(Object.entries(submission).filter(([, v]) => v)),
    skills,
    client: { clientCompany: job.company, clientLocation: job.location },
  };
}

/** The Spreadsheet as an Excel workbook: one worksheet per sheet, newest submission first. */
export async function buildSubmissionWorkbook(submissions: Submission[]): Promise<Uint8Array> {
  const { buildXlsx } = await import("@/lib/xlsx"); // loaded on demand so the page bundle stays small
  return buildXlsx(
    SHEETS.map((sheet) => ({
      name: sheet.title,
      columns: [{ header: "Job", width: 34 }, ...sheet.columns.map((c) => ({ header: c.label, width: c.width ?? 18 }))],
      rows: submissions.map((row) => {
        const { title, company } = rowLabel(row);
        return [company ? `${title} — ${company}` : title, ...sheet.columns.map((c) => row[sheet.key][c.key] ?? "")];
      }),
    })),
  );
}

/** Download name for the workbook, e.g. "Submissions_2026-11-01.xlsx". */
export const workbookFileName = (now = new Date()) => `Submissions_${isoDate(now)}.xlsx`;
