import type { Education, Resume, ResumeContact, WorkExperience } from "@/lib/types";
import { validateEmail } from "@/lib/client/forms";

/** Error messages keyed by field path, e.g. "workExperience.0.jobTitle". */
export type FormErrors = Record<string, string>;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function newId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${random}`;
}

export function emptyBullet(): WorkExperience["bullets"][number] {
  return { id: newId("bullet"), text: "" };
}

export function emptyWorkExperience(): WorkExperience {
  return {
    id: newId("work"),
    jobTitle: "",
    company: "",
    location: "",
    startDate: "",
    endDate: "",
    bullets: [emptyBullet()],
  };
}

export function emptyEducation(): Education {
  return { id: newId("edu"), institution: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "" };
}

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(withProtocol(url));
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

function checkMonth(value: string | undefined, required: string | null): string | undefined {
  if (!value) return required ?? undefined;
  if (!MONTH_RE.test(value)) return "Use the format YYYY-MM.";
}

export function validateResume(resume: Resume): FormErrors {
  const errors: FormErrors = {};
  const { contact } = resume;

  if (!contact.fullName.trim()) errors["contact.fullName"] = "Enter your full name.";
  const emailError = validateEmail(contact.email);
  if (emailError) errors["contact.email"] = emailError;
  for (const key of ["linkedinUrl", "websiteUrl"] as const) {
    const value = contact[key]?.trim();
    if (value && !isValidUrl(value)) errors[`contact.${key}`] = "Enter a valid link, e.g. linkedin.com/in/you.";
  }

  resume.workExperience.forEach((work, i) => {
    const p = `workExperience.${i}`;
    if (!work.jobTitle.trim()) errors[`${p}.jobTitle`] = "Enter a job title.";
    if (!work.company.trim()) errors[`${p}.company`] = "Enter the company name.";

    const startError = checkMonth(work.startDate, "Add a start date.");
    if (startError) errors[`${p}.startDate`] = startError;

    if (work.endDate !== null) {
      const endError = checkMonth(work.endDate, "Add an end date, or mark this as your current role.");
      if (endError) errors[`${p}.endDate`] = endError;
      else if (!startError && work.endDate < work.startDate) {
        errors[`${p}.endDate`] = "End date can't be before the start date.";
      }
    }
  });

  resume.education.forEach((edu, i) => {
    const p = `education.${i}`;
    if (!edu.institution.trim()) errors[`${p}.institution`] = "Enter the school or university.";
    if (!edu.degree.trim()) errors[`${p}.degree`] = "Enter the degree, e.g. B.Sc.";

    const startError = checkMonth(edu.startDate, null);
    if (startError) errors[`${p}.startDate`] = startError;

    if (edu.endDate) {
      const endError = checkMonth(edu.endDate, null);
      if (endError) errors[`${p}.endDate`] = endError;
      else if (edu.startDate && !startError && edu.endDate < edu.startDate) {
        errors[`${p}.endDate`] = "End date can't be before the start date.";
      }
    }
  });

  return errors;
}

// Field paths the form can show an error under. Bullet errors use the bullet id, not its index.
const SHOWN_FIELDS = [
  /^contact\.(fullName|email|phone|location|linkedinUrl|websiteUrl)$/,
  /^summary$/,
  /^workExperience\.\d+\.(jobTitle|company|location|startDate|endDate)$/,
  /^workExperience\.\d+\.bullets\.[^.]+$/,
  /^education\.\d+\.(institution|degree|fieldOfStudy|startDate|endDate)$/,
  /^skills$/,
];

const SERVER_MESSAGES: Record<string, string> = {
  Required: "This field is required.",
};

/**
 * Maps ApiError.fieldErrors from the server onto the form's error keys.
 * `sent` is the exact payload that was submitted, used to turn bullet indexes into ids.
 * Errors for fields the form doesn't display are returned in `other`.
 */
export function mapServerFieldErrors(
  fieldErrors: Record<string, string>,
  sent: Resume,
): { fieldErrors: FormErrors; other: string[] } {
  const mapped: FormErrors = {};
  const other: string[] = [];

  for (const [path, raw] of Object.entries(fieldErrors)) {
    const message = SERVER_MESSAGES[raw] ?? raw;
    let key = path;

    const bullet = /^workExperience\.(\d+)\.bullets\.(\d+)(?:\.\w+)?$/.exec(path);
    if (bullet) {
      const id = sent.workExperience[Number(bullet[1])]?.bullets[Number(bullet[2])]?.id;
      if (id) key = `workExperience.${bullet[1]}.bullets.${id}`;
    } else if (/^skills\.\d+$/.test(path)) {
      key = "skills";
    }

    if (SHOWN_FIELDS.some((re) => re.test(key))) mapped[key] ??= message;
    else other.push(`${path}: ${raw}`);
  }

  return { fieldErrors: mapped, other };
}

/** Removes errors for a field path and everything under it. */
export function withoutErrors(errors: FormErrors, prefixes: string[]): FormErrors {
  const next: FormErrors = {};
  for (const [key, message] of Object.entries(errors)) {
    if (!prefixes.some((p) => key === p || key.startsWith(`${p}.`))) next[key] = message;
  }
  return next;
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Drops keys whose value is undefined, so optional fields are omitted rather than empty. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** Trims text, removes empty optional fields and blank bullets, and de-duplicates skills. */
export function normalizeResume(resume: Resume): Resume {
  const c = resume.contact;
  const linkedin = optional(c.linkedinUrl);
  const website = optional(c.websiteUrl);

  const contact: ResumeContact = compact({
    fullName: c.fullName.trim(),
    email: c.email.trim(),
    phone: optional(c.phone),
    location: optional(c.location),
    linkedinUrl: linkedin && withProtocol(linkedin),
    websiteUrl: website && withProtocol(website),
  });

  const workExperience = resume.workExperience.map((w) =>
    compact<WorkExperience>({
      id: w.id,
      jobTitle: w.jobTitle.trim(),
      company: w.company.trim(),
      location: optional(w.location),
      startDate: w.startDate,
      endDate: w.endDate,
      bullets: w.bullets.map((b) => ({ id: b.id, text: b.text.trim() })).filter((b) => b.text),
    }),
  );

  const education = resume.education.map((e) =>
    compact<Education>({
      id: e.id,
      institution: e.institution.trim(),
      degree: e.degree.trim(),
      fieldOfStudy: optional(e.fieldOfStudy),
      startDate: optional(e.startDate),
      endDate: e.endDate === null ? null : optional(e.endDate),
    }),
  );

  const seen = new Set<string>();
  const skills = resume.skills
    .map((s) => s.trim())
    .filter((s) => {
      const key = s.toLowerCase();
      if (!s || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return compact<Resume>({
    ...resume,
    contact,
    summary: optional(resume.summary),
    workExperience,
    education,
    skills,
    updatedAt: new Date().toISOString(),
  });
}
