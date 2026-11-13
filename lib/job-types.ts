// Job Board employment types: Full Time, C2C (corp-to-corp contract) and W2 (contract on the
// staffing company's payroll). A job can have several ("C2C or W2"). Shared by the API and the page.

export const JOB_TYPES = ["Full-time", "C2C", "W2"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_TYPE_LABEL: Record<JobType, string> = { "Full-time": "Full Time", C2C: "C2C", W2: "W2" };

export const JOB_TYPE_HINT: Record<JobType, string> = {
  "Full-time": "Permanent role on the company's payroll",
  C2C: "Corp-to-corp contract, billed through your own company",
  W2: "Contract role on the employer's or vendor's payroll",
};

/** The valid types in a value, in the standard order, without repeats; null if it isn't a list of them. */
export function parseJobTypes(value: unknown): JobType[] | null {
  if (!Array.isArray(value) || value.some((v) => !(JOB_TYPES as readonly unknown[]).includes(v))) return null;
  return JOB_TYPES.filter((t) => value.includes(t));
}

/**
 * The types a job description mentions ("C2C", "corp-to-corp", "W2", "full-time", "permanent").
 * A job that names none is treated as Full Time.
 */
export function inferJobTypes(text: string): JobType[] {
  const found = new Set<JobType>();
  if (/\bc2c\b|\bcorp[\s-]*(?:to|2)[\s-]*corp\b/i.test(text)) found.add("C2C");
  if (/\bw-?2\b/i.test(text)) found.add("W2");
  if (/\bfull[\s-]?time\b|\bpermanent\b|\bfte\b/i.test(text)) found.add("Full-time");
  return found.size ? JOB_TYPES.filter((t) => found.has(t)) : ["Full-time"];
}

/** A job's types: the stored ones, or (for jobs saved before types existed) read from its description. */
export function jobTypesOf(stored: readonly string[] | null | undefined, description: string): JobType[] {
  const types = parseJobTypes(stored ?? []);
  return types?.length ? types : inferJobTypes(description);
}
