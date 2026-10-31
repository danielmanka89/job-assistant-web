import type { Education, ResumeContact, WorkExperience } from "@/lib/types";

/** The user-editable part of a Resume, as accepted by PUT /api/resumes/:id. */
export interface ResumeUpdate {
  contact: ResumeContact;
  summary: string | null;
  workExperience: WorkExperience[];
  education: Education[];
  skills: string[];
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/; // "YYYY-MM"
const MAX_TEXT = 2000;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Validates a Resume-shaped body. Errors are keyed by field path,
 * e.g. "workExperience.0.startDate", so the form can highlight them.
 */
export function validateResumeUpdate(
  body: Obj,
): { fieldErrors: Record<string, string> } | { data: ResumeUpdate } {
  const errors: Record<string, string> = {};

  const requiredText = (obj: Obj, key: string, path: string): string => {
    const v = obj[key];
    if (typeof v !== "string" || !v.trim()) errors[path] = "Required";
    else if (v.length > MAX_TEXT) errors[path] = `Must be ${MAX_TEXT} characters or fewer`;
    return typeof v === "string" ? v.trim() : "";
  };
  const optionalText = (obj: Obj, key: string, path: string): string | undefined => {
    const v = obj[key];
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v !== "string") errors[path] = "Must be text";
    else if (v.length > MAX_TEXT) errors[path] = `Must be ${MAX_TEXT} characters or fewer`;
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  // undefined = field omitted, null = explicitly empty (e.g. current role).
  const month = (obj: Obj, key: string, path: string, required: boolean): string | null | undefined => {
    const v = obj[key];
    if (v === undefined || v === "") {
      if (required) errors[path] = "Required";
      return undefined;
    }
    if (v === null) return null;
    if (typeof v !== "string" || !MONTH_PATTERN.test(v)) errors[path] = 'Use the format "YYYY-MM"';
    return typeof v === "string" ? v : undefined;
  };
  const list = (key: string): unknown[] => {
    const v = body[key];
    if (!Array.isArray(v)) {
      errors[key] = "Must be a list";
      return [];
    }
    return v;
  };

  const c = isObj(body.contact) ? body.contact : {};
  if (!isObj(body.contact)) errors.contact = "Required";
  const contact: ResumeContact = {
    fullName: requiredText(c, "fullName", "contact.fullName"),
    email: requiredText(c, "email", "contact.email"),
  };
  for (const key of ["phone", "location", "linkedinUrl", "websiteUrl"] as const) {
    const v = optionalText(c, key, `contact.${key}`);
    if (v) contact[key] = v;
  }

  const summary = optionalText(body, "summary", "summary") ?? null;

  const workExperience: WorkExperience[] = list("workExperience").map((item, i) => {
    const p = `workExperience.${i}`;
    const w = isObj(item) ? item : {};
    if (!isObj(item)) errors[p] = "Invalid entry";
    const entry: WorkExperience = {
      id: requiredText(w, "id", `${p}.id`),
      jobTitle: requiredText(w, "jobTitle", `${p}.jobTitle`),
      company: requiredText(w, "company", `${p}.company`),
      startDate: month(w, "startDate", `${p}.startDate`, true) ?? "",
      endDate: month(w, "endDate", `${p}.endDate`, false) ?? null,
      bullets: [],
    };
    const location = optionalText(w, "location", `${p}.location`);
    if (location) entry.location = location;
    if (!Array.isArray(w.bullets)) errors[`${p}.bullets`] = "Must be a list";
    else {
      entry.bullets = w.bullets.map((b, j) => {
        const bp = `${p}.bullets.${j}`;
        const bo = isObj(b) ? b : {};
        return { id: requiredText(bo, "id", `${bp}.id`), text: requiredText(bo, "text", `${bp}.text`) };
      });
    }
    return entry;
  });

  const education: Education[] = list("education").map((item, i) => {
    const p = `education.${i}`;
    const e = isObj(item) ? item : {};
    if (!isObj(item)) errors[p] = "Invalid entry";
    const entry: Education = {
      id: requiredText(e, "id", `${p}.id`),
      institution: requiredText(e, "institution", `${p}.institution`),
      degree: requiredText(e, "degree", `${p}.degree`),
    };
    const fieldOfStudy = optionalText(e, "fieldOfStudy", `${p}.fieldOfStudy`);
    if (fieldOfStudy) entry.fieldOfStudy = fieldOfStudy;
    const startDate = month(e, "startDate", `${p}.startDate`, false);
    if (startDate) entry.startDate = startDate;
    const endDate = month(e, "endDate", `${p}.endDate`, false);
    if (endDate !== undefined) entry.endDate = endDate;
    return entry;
  });

  const skills = list("skills").map((s, i) => {
    if (typeof s !== "string" || !s.trim()) errors[`skills.${i}`] = "Must be non-empty text";
    return typeof s === "string" ? s.trim() : "";
  });

  return Object.keys(errors).length
    ? { fieldErrors: errors }
    : { data: { contact, summary, workExperience, education, skills } };
}

const MAX_NEW_SKILLS = 50;
const MAX_SKILL_CHARS = 100;

/** Validates the body of PATCH /api/resumes/:id: { newSkills: string[] }. */
export function validateNewSkills(body: Obj): { fieldErrors: Record<string, string> } | { data: string[] } {
  const v = body.newSkills;
  if (!Array.isArray(v) || v.length === 0) return { fieldErrors: { newSkills: "Pick at least one skill to add" } };
  if (v.length > MAX_NEW_SKILLS) return { fieldErrors: { newSkills: `Add at most ${MAX_NEW_SKILLS} skills at a time` } };

  const errors: Record<string, string> = {};
  const skills = v.map((s, i) => {
    if (typeof s !== "string" || !s.trim()) errors[`newSkills.${i}`] = "Must be non-empty text";
    else if (s.trim().length > MAX_SKILL_CHARS) errors[`newSkills.${i}`] = `Must be ${MAX_SKILL_CHARS} characters or fewer`;
    return typeof s === "string" ? s.trim() : "";
  });
  return Object.keys(errors).length ? { fieldErrors: errors } : { data: skills };
}
