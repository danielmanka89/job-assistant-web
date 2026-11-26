// My JDs (server side): checking input, detecting a JD's details, and shaping rows for the page.

import { AiError, extractJdDetails } from "@/lib/ai";
import { toGeneratedFile } from "@/lib/api";
import { isEmailAddress } from "@/lib/email";
import type { Prisma } from "@/lib/generated/prisma/client";
import { detectJdDetails, guessTitle, type JdDetails } from "@/lib/jd-details";
import { VENDOR_JD_MAX_CHARS, VENDOR_JD_MIN_CHARS, type SaveVendorJdRequest, type VendorJd, type VendorJdFields } from "@/lib/types";

export const LIMITS: Record<keyof VendorJdFields, number> = {
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

/** What every JD query loads: its tailored resume's files (without their bytes) and keywords. */
export const JD_INCLUDE = {
  tailoredResume: {
    select: {
      id: true,
      sourceResumeId: true,
      finalMatchPercent: true,
      createdAt: true,
      gapAnalysis: { select: { matchedKeywords: true, missingKeywords: true } },
      files: { omit: { data: true }, orderBy: { createdAt: "asc" } },
    },
  },
} satisfies Prisma.VendorJdInclude;

export type JdRow = Prisma.VendorJdGetPayload<{ include: typeof JD_INCLUDE }>;

export function descriptionError(value: string): string | undefined {
  if (!value) return "Paste the job description";
  if (value.length < VENDOR_JD_MIN_CHARS) return `That looks too short. Paste the full job description (at least ${VENDOR_JD_MIN_CHARS} characters).`;
  if (value.length > VENDOR_JD_MAX_CHARS) return `Job descriptions can be at most ${VENDOR_JD_MAX_CHARS.toLocaleString("en-US")} characters`;
  return undefined;
}

/**
 * The fields present in a create/update body, trimmed and checked. With `creating`, the description
 * is required; the other fields may be left out and are detected from it.
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

  if (!creating && data.title === "") fieldErrors.title = "Give the role a name";
  return { data, fieldErrors };
}

/**
 * The JD's details, read by the AI (or, if it isn't available, by simple patterns), cut to the
 * field limits. A detected email that isn't valid is dropped.
 */
export async function detectDetails(description: string): Promise<JdDetails> {
  let found: JdDetails;
  try {
    found = await extractJdDetails(description);
  } catch (error) {
    if (!(error instanceof AiError)) throw error;
    console.error("JD detail detection fell back to patterns", error.reason);
    found = detectJdDetails(description);
  }
  const fit = (key: keyof JdDetails) => {
    const value = found[key].trim();
    return value.length > LIMITS[key] ? `${value.slice(0, LIMITS[key] - 1)}…` : value;
  };
  const vendorEmail = fit("vendorEmail");
  return {
    title: fit("title") || guessTitle(description),
    client: fit("client"),
    location: fit("location"),
    rate: fit("rate"),
    vendorCompany: fit("vendorCompany"),
    vendorContact: fit("vendorContact"),
    vendorEmail: isEmailAddress(vendorEmail) ? vendorEmail : "",
  };
}

/** A JD as the page shows it. */
export function toVendorJd(row: JdRow): VendorJd {
  const t = row.tailoredResume;
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
          matchedKeywords: t.gapAnalysis.matchedKeywords as string[],
          missingKeywords: t.gapAnalysis.missingKeywords as string[],
          files: t.files.map((f) => toGeneratedFile(f, t.sourceResumeId)),
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
