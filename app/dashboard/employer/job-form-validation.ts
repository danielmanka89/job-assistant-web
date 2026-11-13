import type { CreateJobPostingRequest } from "@/lib/types";

// Same limits POST /api/jobs enforces, so most problems are caught before sending.
export const LIMITS = { title: 200, company: 200, location: 200, applyUrl: 2000 } as const;
export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 20_000;

export type JobField = keyof CreateJobPostingRequest;
export type JobFormErrors = Partial<Record<JobField, string>>;

export const JOB_FIELDS: JobField[] = ["title", "company", "location", "employmentTypes", "applyUrl", "description"];

export const EMPTY_JOB: CreateJobPostingRequest = { title: "", company: "", location: "", applyUrl: "", description: "", employmentTypes: [] };

export function cleanJob(values: CreateJobPostingRequest): CreateJobPostingRequest {
  return {
    title: values.title.trim(),
    company: values.company.trim(),
    location: values.location.trim(),
    applyUrl: values.applyUrl.trim(),
    description: values.description.trim(),
    employmentTypes: values.employmentTypes,
  };
}

export function validateJob(values: CreateJobPostingRequest): JobFormErrors {
  const job = cleanJob(values);
  const errors: JobFormErrors = {};
  const labels = { title: "Job title", company: "Company", location: "Location" } as const;

  for (const key of ["title", "company", "location"] as const) {
    if (!job[key]) errors[key] = `${labels[key]} is required.`;
    else if (job[key].length > LIMITS[key]) errors[key] = `Keep it under ${LIMITS[key]} characters.`;
  }

  if (!job.employmentTypes.length) errors.employmentTypes = "Choose at least one: Full Time, C2C or W2.";

  if (!job.applyUrl) {
    errors.applyUrl = "Add the link where candidates apply.";
  } else if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(job.applyUrl)) {
    errors.applyUrl = "Enter a full link starting with https://";
  } else if (job.applyUrl.length > LIMITS.applyUrl) {
    errors.applyUrl = `Keep the link under ${LIMITS.applyUrl.toLocaleString()} characters.`;
  }

  if (!job.description) {
    errors.description = "Add the job description.";
  } else if (job.description.length < DESCRIPTION_MIN) {
    errors.description = `Add the full job description (at least ${DESCRIPTION_MIN} characters).`;
  } else if (job.description.length > DESCRIPTION_MAX) {
    errors.description = `Keep it under ${DESCRIPTION_MAX.toLocaleString()} characters.`;
  }
  return errors;
}

/** Maps POST /api/jobs fieldErrors onto the form; anything else goes to the banner. */
export function splitServerErrors(fieldErrors: Record<string, string> = {}) {
  const errors: JobFormErrors = {};
  const other: string[] = [];
  for (const [key, message] of Object.entries(fieldErrors)) {
    if ((JOB_FIELDS as string[]).includes(key)) errors[key as JobField] = message === "Required" ? "This field is required." : message;
    else other.push(message);
  }
  return { errors, other };
}
