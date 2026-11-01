// The job seeker's saved profile, shared by the API, the Profile page and the places that use it
// (no server-only imports). Filled-in profile fields win over what's read from the resume when a
// job is applied to (Spreadsheet row) or a resume is tailored (contact details and skills).

import type { ProfileChange, ProfileValues, Resume, User } from "@/lib/types";
import { mergeSkills } from "@/lib/skills";

export type ProfileFieldType = "text" | "email" | "url" | "tel" | "select" | "long" | "years";

export interface ProfileField {
  key: string;
  label: string;
  type?: ProfileFieldType; // default "text"
  options?: readonly string[];
  hint?: string;
  maxLength?: number; // default 200
}

export interface ProfileSection {
  title: string;
  description: string;
  fields: readonly ProfileField[];
}

export const EMPLOYMENT_TYPES = ["W2", "C2C", "1099", "Full-time", "Contract-to-hire"] as const;

export const PROFILE_SECTIONS: readonly ProfileSection[] = [
  {
    title: "Contact details",
    description: "Shown at the top of every tailored resume and filled into each submission.",
    fields: [
      { key: "fullName", label: "Full name", maxLength: 100 },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "tel", maxLength: 40 },
      { key: "location", label: "Location", hint: "City and state or country, e.g. Dallas, TX" },
      { key: "linkedinUrl", label: "LinkedIn", type: "url", maxLength: 500 },
      { key: "websiteUrl", label: "Website or portfolio", type: "url", maxLength: 500 },
    ],
  },
  {
    title: "Work details",
    description: "What vendors and clients ask for on every submission.",
    fields: [
      { key: "workAuthorization", label: "Work authorization", hint: "e.g. US Citizen, Green Card, H-1B, OPT" },
      { key: "employmentType", label: "Preferred employment type", type: "select", options: EMPLOYMENT_TYPES },
      { key: "expectedRate", label: "Expected rate or salary", hint: "e.g. $65/hr or $120,000/yr" },
      { key: "availability", label: "Availability", hint: "e.g. Immediate, 2 weeks notice" },
    ],
  },
  {
    title: "Experience and skills",
    description: "Your skills are added to your resume's skills when you tailor it and when a job is matched.",
    fields: [
      { key: "totalExperience", label: "Total experience (years)", type: "years", hint: "Leave blank to work it out from your resume" },
      { key: "education", label: "Highest education", hint: "e.g. M.S. Computer Science, UT Dallas" },
      { key: "skills", label: "Skills", type: "long", maxLength: 2000, hint: "Separate with commas" },
      { key: "certifications", label: "Certifications", type: "long", maxLength: 2000, hint: "Separate with commas" },
    ],
  },
];

export const PROFILE_FIELDS: readonly ProfileField[] = PROFILE_SECTIONS.flatMap((s) => s.fields);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks a whole profile. Unknown keys are errors; blank fields are fine (everything is optional). */
export function validateProfile(input: unknown): { values: ProfileValues; fieldErrors: Record<string, string> } {
  const values: ProfileValues = {};
  const fieldErrors: Record<string, string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { values, fieldErrors: { values: "Must be an object of field -> text" } };
  }
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const field = PROFILE_FIELDS.find((f) => f.key === key);
    if (!field) {
      fieldErrors[key] = "Unknown field";
      continue;
    }
    if (typeof raw !== "string") {
      fieldErrors[key] = "Must be text";
      continue;
    }
    const value = raw.trim();
    if (!value) continue;
    const max = field.maxLength ?? 200;
    if (value.length > max) fieldErrors[key] = `Use ${max.toLocaleString("en-US")} characters or fewer.`;
    else if (field.type === "email" && !EMAIL.test(value)) fieldErrors[key] = "Enter an email like name@example.com.";
    else if (field.type === "url" && !/^https?:\/\/\S+$/i.test(value)) fieldErrors[key] = "Enter a full link starting with https://";
    else if (field.type === "select" && !field.options?.includes(value)) fieldErrors[key] = `Choose one of: ${field.options?.join(", ")}`;
    else if (field.type === "years" && !(/^\d{1,2}(\.\d)?$/.test(value) && Number(value) <= 60)) {
      fieldErrors[key] = "Enter a number of years, e.g. 7 or 7.5.";
    } else values[key] = value;
  }
  return { values, fieldErrors };
}

/** A comma- or line-separated list as items, blanks dropped. */
export const splitList = (text: string | undefined) =>
  (text ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The resume with the profile applied: filled-in contact fields replace the resume's, and the
 * profile's skills are added after the resume's own. Bullets and everything else are unchanged.
 */
export function withProfile<T extends Pick<Resume, "contact" | "skills">>(resume: T, profile: ProfileValues): T {
  const contact = { ...resume.contact };
  if (profile.fullName) contact.fullName = profile.fullName;
  if (profile.email) contact.email = profile.email;
  for (const key of ["phone", "location", "linkedinUrl", "websiteUrl"] as const) {
    if (profile[key]) contact[key] = profile[key];
  }
  return { ...resume, contact, skills: mergeSkills(resume.skills, splitList(profile.skills)) };
}

/**
 * Values to start an empty profile with: the account's name and email, then the latest resume's
 * contact details and skills. Shown on the Profile page until the user saves.
 */
export function profileSuggestions(user: Pick<User, "name" | "email">, resume: Pick<Resume, "contact" | "skills" | "education"> | null): ProfileValues {
  const c = resume?.contact;
  const degree = resume?.education[0];
  const suggestions: ProfileValues = {
    fullName: c?.fullName || user.name,
    email: c?.email || user.email,
    phone: c?.phone ?? "",
    location: c?.location ?? "",
    linkedinUrl: c?.linkedinUrl ?? "",
    websiteUrl: c?.websiteUrl ?? "",
    skills: resume?.skills.join(", ") ?? "",
    education: degree ? [degree.degree, degree.fieldOfStudy, degree.institution].filter(Boolean).join(", ") : "",
  };
  return Object.fromEntries(Object.entries(suggestions).filter(([, v]) => v));
}

/**
 * Profile fields that come from the resume. The resume is the source of truth for these: syncing
 * sets each one to the resume's value, and clears it when the resume doesn't have one. The other
 * fields (work details, years, certifications) aren't on a resume and are left alone.
 */
export const RESUME_PROFILE_FIELDS = ["fullName", "email", "phone", "location", "linkedinUrl", "websiteUrl", "education", "skills"] as const;

const withScheme = (url: string | undefined) => (url && !/^https?:\/\//i.test(url) ? `https://${url}` : (url ?? ""));

/** Cuts a comma-separated list at the last whole item that fits. */
function clipList(items: string[], max: number): string {
  let out = "";
  for (const item of items) {
    const next = out ? `${out}, ${item}` : item;
    if (next.length > max) break;
    out = next;
  }
  return out;
}

/** The profile values the resume implies, for the fields in RESUME_PROFILE_FIELDS. */
export function profileFromResume(resume: Pick<Resume, "contact" | "skills" | "education">): Record<(typeof RESUME_PROFILE_FIELDS)[number], string> {
  const field = (key: string) => PROFILE_FIELDS.find((f) => f.key === key)!;
  const clip = (key: string, value: string | undefined) => (value ?? "").trim().slice(0, field(key).maxLength ?? 200);
  const c = resume.contact;
  const degree = resume.education[0];
  return {
    fullName: clip("fullName", c.fullName),
    email: clip("email", c.email),
    phone: clip("phone", c.phone),
    location: clip("location", c.location),
    linkedinUrl: clip("linkedinUrl", withScheme(c.linkedinUrl)),
    websiteUrl: clip("websiteUrl", withScheme(c.websiteUrl)),
    education: clip("education", degree ? [degree.degree, degree.fieldOfStudy, degree.institution].filter(Boolean).join(", ") : ""),
    skills: clipList(resume.skills, field("skills").maxLength ?? 2000),
  };
}

/** The profile after syncing it to the resume, and what changed (in form order). */
export function syncProfileToResume(
  current: ProfileValues,
  resume: Pick<Resume, "contact" | "skills" | "education">,
): { values: ProfileValues; changes: ProfileChange[] } {
  const fromResume = profileFromResume(resume);
  const values: ProfileValues = { ...current };
  const changes: ProfileChange[] = [];
  for (const key of RESUME_PROFILE_FIELDS) {
    const from = (current[key] ?? "").trim();
    const to = fromResume[key];
    if (to) values[key] = to;
    else delete values[key];
    // Skills that differ only in order or case aren't a change worth confirming.
    const same = key === "skills" ? sameList(from, to) : from === to;
    if (!same) changes.push({ field: key, label: PROFILE_FIELDS.find((f) => f.key === key)!.label, from, to });
  }
  return { values, changes };
}

function sameList(a: string, b: string): boolean {
  const norm = (s: string) => [...new Set(splitList(s).map((x) => x.toLowerCase()))].sort().join("\n");
  return norm(a) === norm(b);
}
