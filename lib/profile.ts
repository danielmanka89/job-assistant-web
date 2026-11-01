// The job seeker's profile, shared by the API, the Profile page and the places that use it (no
// server-only imports). The profile comes only from the resume: it can't be edited, it's created
// from the first resume and changes only when the user confirms a new resume's differences.
// It's used when a job is applied to (Spreadsheet row) and when a resume is tailored.

import type { ProfileChange, ProfileValues, Resume } from "@/lib/types";
import { mergeSkills } from "@/lib/skills";

/** The profile fields, all read from the resume. */
export const RESUME_PROFILE_FIELDS = [
  "fullName",
  "email",
  "phone",
  "location",
  "linkedinUrl",
  "websiteUrl",
  "workAuthorization",
  "desiredPay",
  "education",
  "skills",
  "certifications",
] as const;

export interface ProfileField {
  key: (typeof RESUME_PROFILE_FIELDS)[number];
  label: string;
  type?: "text" | "email" | "url" | "list"; // how the Profile page shows it; default "text"
  maxLength?: number; // default 200
}

export interface ProfileSection {
  id: "contact" | "work" | "education" | "skills";
  title: string;
  description: string;
  fields: readonly ProfileField[];
}

export const PROFILE_SECTIONS: readonly ProfileSection[] = [
  {
    id: "contact",
    title: "Contact details",
    description: "Shown at the top of every tailored resume and filled into each submission.",
    fields: [
      { key: "fullName", label: "Full name", maxLength: 100 },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", maxLength: 40 },
      { key: "location", label: "Location" },
      { key: "linkedinUrl", label: "LinkedIn", type: "url", maxLength: 500 },
      { key: "websiteUrl", label: "Website or portfolio", type: "url", maxLength: 500 },
    ],
  },
  {
    id: "work",
    title: "Work authorization and pay",
    description: "Filled into each submission. Only shown when your resume states them.",
    fields: [
      { key: "workAuthorization", label: "Visa / work authorization" },
      { key: "desiredPay", label: "Pay rate looking for" },
    ],
  },
  {
    id: "education",
    title: "Education",
    description: "Your most recent degree, filled into each submission's skill matrix.",
    fields: [{ key: "education", label: "Highest education" }],
  },
  {
    id: "skills",
    title: "Skills and certifications",
    description: "Used to match you to jobs and filled into each submission's skill matrix.",
    fields: [
      { key: "skills", label: "Skills", type: "list", maxLength: 2000 },
      { key: "certifications", label: "Certifications", type: "list", maxLength: 2000 },
    ],
  },
];

export const PROFILE_FIELDS: readonly ProfileField[] = PROFILE_SECTIONS.flatMap((s) => s.fields);

/** A comma- or line-separated list as items, blanks dropped. */
export const splitList = (text: string | undefined) =>
  (text ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The resume with the profile applied: profile contact fields replace the resume's, and the
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

/** The profile a resume gives, with blank fields left out. */
export function profileFromResume(resume: Pick<Resume, "contact" | "skills" | "education" | "certifications">): ProfileValues {
  const max = (key: string) => PROFILE_FIELDS.find((f) => f.key === key)?.maxLength ?? 200;
  const clip = (key: string, value: string | undefined) => (value ?? "").trim().slice(0, max(key));
  const c = resume.contact;
  const degree = resume.education[0];
  const values: ProfileValues = {
    fullName: clip("fullName", c.fullName),
    email: clip("email", c.email),
    phone: clip("phone", c.phone),
    location: clip("location", c.location),
    linkedinUrl: clip("linkedinUrl", withScheme(c.linkedinUrl)),
    websiteUrl: clip("websiteUrl", withScheme(c.websiteUrl)),
    workAuthorization: clip("workAuthorization", c.workAuthorization),
    desiredPay: clip("desiredPay", c.desiredPay),
    education: clip("education", degree ? [degree.degree, degree.fieldOfStudy, degree.institution].filter(Boolean).join(", ") : ""),
    skills: clipList(resume.skills, max("skills")),
    certifications: clipList(resume.certifications ?? [], max("certifications")),
  };
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v));
}

/** The profile after syncing it to the resume (the resume's values, nothing else), and what changed. */
export function syncProfileToResume(
  current: ProfileValues,
  resume: Pick<Resume, "contact" | "skills" | "education" | "certifications">,
): { values: ProfileValues; changes: ProfileChange[] } {
  const values = profileFromResume(resume);
  const changes: ProfileChange[] = [];
  for (const field of PROFILE_FIELDS) {
    const from = (current[field.key] ?? "").trim();
    const to = values[field.key] ?? "";
    // Lists that differ only in order or case aren't a change worth confirming.
    const same = field.type === "list" ? sameList(from, to) : from === to;
    if (!same) changes.push({ field: field.key, label: field.label, from, to });
  }
  return { values, changes };
}

function sameList(a: string, b: string): boolean {
  const norm = (s: string) => [...new Set(splitList(s).map((x) => x.toLowerCase()))].sort().join("\n");
  return norm(a) === norm(b);
}

/** True when the profile has nothing in it yet, so the first resume can fill it without asking. */
export const isEmptyProfile = (values: ProfileValues) => !PROFILE_FIELDS.some((f) => values[f.key]?.trim());
