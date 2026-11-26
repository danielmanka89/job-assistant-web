// My JDs (server side): checking what the user typed, and finding each JD's tailored resume.

import { toGeneratedFile } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isEmailAddress } from "@/lib/email";
import type { VendorJd as VendorJdRow } from "@/lib/generated/prisma/client";
import { VENDOR_JD_MAX_CHARS, VENDOR_JD_MIN_CHARS, type SaveVendorJdRequest, type VendorJd, type VendorJdFields } from "@/lib/types";

const LIMITS: Record<keyof VendorJdFields, number> = {
  title: 150,
  client: 120,
  location: 120,
  rate: 60,
  vendorCompany: 120,
  vendorContact: 120,
  vendorEmail: 254,
  notes: 2000,
};
const FIELDS = Object.keys(LIMITS) as (keyof VendorJdFields)[];

/** A role name from the description itself: a "Job Title:" line, or else its first short line. */
export function guessTitle(description: string): string {
  const labelled = description.match(/^\s*(?:job\s*title|position|role|title)\s*[:\-–]\s*(.+)$/im)?.[1];
  const firstLine = description.split(/\n/).map((l) => l.trim()).find(Boolean) ?? "";
  const pick = (labelled ?? firstLine).replace(/\s+/g, " ").trim();
  if (!pick) return "Untitled JD";
  return pick.length > LIMITS.title ? `${pick.slice(0, LIMITS.title - 1).replace(/\s+\S*$/, "")}…` : pick;
}

export function descriptionError(value: string): string | undefined {
  if (!value) return "Paste the job description";
  if (value.length < VENDOR_JD_MIN_CHARS) return `That looks too short. Paste the full job description (at least ${VENDOR_JD_MIN_CHARS} characters).`;
  if (value.length > VENDOR_JD_MAX_CHARS) return `Job descriptions can be at most ${VENDOR_JD_MAX_CHARS.toLocaleString("en-US")} characters`;
  return undefined;
}

/**
 * The fields present in a create/update body, trimmed and checked. With `creating`, the description
 * is required and a missing title is taken from the description.
 */
export function readVendorJdInput(
  body: Record<string, unknown>,
  creating: boolean,
): { data: SaveVendorJdRequest; fieldErrors: Record<string, string> } {
  const data: SaveVendorJdRequest = {};
  const fieldErrors: Record<string, string> = {};

  for (const key of FIELDS) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value !== "string") {
      fieldErrors[key] = "Must be text";
      continue;
    }
    const text = key === "notes" ? value.trim() : value.replace(/\s+/g, " ").trim();
    if (text.length > LIMITS[key]) fieldErrors[key] = `At most ${LIMITS[key]} characters`;
    else if (key === "vendorEmail" && text && !isEmailAddress(text.toLowerCase())) fieldErrors[key] = "Enter one email address, like name@example.com";
    else data[key] = key === "vendorEmail" ? text.toLowerCase() : text;
  }

  if (body.jobDescription !== undefined || creating) {
    const description = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
    const problem = descriptionError(description);
    if (problem) fieldErrors.jobDescription = problem;
    else data.jobDescription = description;
  }

  if (data.title === "") {
    if (creating) delete data.title;
    else fieldErrors.title = "Give the role a name";
  }
  if (creating && !data.title && data.jobDescription) data.title = guessTitle(data.jobDescription);
  return { data, fieldErrors };
}

/**
 * The JDs as the page shows them. A JD's tailored resume is the newest one made from a match of
 * this exact description (the analyze page trims the text the same way).
 */
export async function toVendorJds(userId: string, rows: VendorJdRow[]): Promise<VendorJd[]> {
  const descriptions = [...new Set(rows.map((r) => r.jobDescription.trim()))];
  const tailored = descriptions.length
    ? await prisma.tailoredResume.findMany({
        where: { userId, gapAnalysis: { jobDescription: { in: descriptions } } },
        select: {
          id: true,
          sourceResumeId: true,
          finalMatchPercent: true,
          createdAt: true,
          gapAnalysis: { select: { jobDescription: true } },
          files: { omit: { data: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const newest = new Map<string, (typeof tailored)[number]>();
  for (const t of tailored) if (!newest.has(t.gapAnalysis.jobDescription)) newest.set(t.gapAnalysis.jobDescription, t);

  return rows.map((row) => {
    const t = newest.get(row.jobDescription.trim());
    return {
      id: row.id,
      title: row.title,
      client: row.client,
      location: row.location,
      rate: row.rate,
      vendorCompany: row.vendorCompany,
      vendorContact: row.vendorContact,
      vendorEmail: row.vendorEmail,
      notes: row.notes,
      jobDescription: row.jobDescription,
      sentAt: row.sentAt?.toISOString() ?? null,
      sentTo: row.sentTo,
      submissionId: row.submissionId,
      tailored: t
        ? {
            id: t.id,
            finalMatchPercent: t.finalMatchPercent,
            createdAt: t.createdAt.toISOString(),
            files: t.files.map((f) => toGeneratedFile(f, t.sourceResumeId)),
          }
        : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}
