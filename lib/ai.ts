import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Education, ResumeContact, WorkExperience } from "@/lib/types";

const MODEL = "claude-opus-5-5";

/** Why parsing failed, so the upload route can pick the right status code. */
export type ResumeParseFailure = "not_configured" | "unreadable" | "unavailable";

export class ResumeParseError extends Error {
  constructor(
    readonly reason: ResumeParseFailure,
    message: string,
  ) {
    super(message);
  }
}

/** The Resume fields filled from the file. contact name/email may be missing from the document. */
export interface ParsedResume {
  contact: Partial<ResumeContact>;
  summary?: string;
  workExperience: WorkExperience[];
  education: Education[];
  skills: string[];
}

// Missing values are null rather than optional so the model always states "not present".
// Ids are assigned by the server, not the model.
const ParsedResumeSchema = z.object({
  contact: z.object({
    fullName: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    linkedinUrl: z.string().nullable(),
    websiteUrl: z.string().nullable(),
  }),
  summary: z.string().nullable(),
  workExperience: z.array(
    z.object({
      jobTitle: z.string(),
      company: z.string(),
      location: z.string().nullable(),
      startDate: z.string().nullable().describe('"YYYY-MM"'),
      endDate: z.string().nullable().describe('"YYYY-MM", or null if current'),
      isCurrent: z.boolean(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      fieldOfStudy: z.string().nullable(),
      startDate: z.string().nullable().describe('"YYYY-MM"'),
      endDate: z.string().nullable().describe('"YYYY-MM"'),
      inProgress: z.boolean(),
    }),
  ),
  skills: z.array(z.string()),
});

const SYSTEM_PROMPT = `You convert the text of a resume into structured data for a resume-tailoring app.

The output is shown back to the resume's owner and used to build applications in their name, so it must contain only what the document says. Never invent, infer, or embellish experience, skills, dates, employers, titles, or metrics. If a field isn't in the text, return null (or an empty list). Don't add skills that aren't listed or clearly named in the text.

- Copy bullet points and the summary as written. You may fix broken line wraps and stray bullet symbols, but don't reword them.
- Dates: use "YYYY-MM". If only a year is given, use "YYYY-01". Spell-out months ("Mar 2021") become "2021-03".
- A role marked "Present", "Current", or similar has endDate null and isCurrent true. Education that is ongoing or expected has inProgress true.
- Keep entries in the order they appear in the document.
- Text from PDFs may have scrambled column order; use the headings to work out which lines belong together.`;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Accepts "YYYY-MM", turns a bare year into "YYYY-01", and drops anything else. */
function toMonth(value: string | null): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (MONTH.test(v)) return v;
  if (/^\d{4}$/.test(v)) return `${v}-01`;
  return undefined;
}

const clean = (value: string | null): string | undefined => value?.trim() || undefined;

let client: Anthropic | undefined;

/** Parses raw resume text into Resume fields with Claude. Throws ResumeParseError on failure. */
export async function parseResumeText(text: string): Promise<ParsedResume> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ResumeParseError("not_configured", "ANTHROPIC_API_KEY is not set");
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If the model declines, the API retries on its default fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(ParsedResumeSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `<resume>\n${text}\n</resume>` }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new ResumeParseError("not_configured", `Anthropic API rejected the key: ${error.message}`);
    }
    if (error instanceof Anthropic.APIError) {
      throw new ResumeParseError("unavailable", `Anthropic API error ${error.status}: ${error.message}`);
    }
    // The SDK throws AnthropicError when the response isn't valid JSON for the schema (e.g. cut off).
    if (error instanceof Anthropic.AnthropicError) {
      throw new ResumeParseError("unreadable", error.message);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new ResumeParseError("unreadable", `Model declined: ${response.stop_details?.category ?? "unknown"}`);
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new ResumeParseError("unreadable", `No structured output (stop_reason: ${response.stop_reason})`);
  }
  const parsed = response.parsed_output;

  const contact: Partial<ResumeContact> = {};
  for (const key of ["fullName", "email", "phone", "location", "linkedinUrl", "websiteUrl"] as const) {
    const v = clean(parsed.contact[key]);
    if (v) contact[key] = v;
  }

  return {
    contact,
    summary: clean(parsed.summary),
    workExperience: parsed.workExperience.map((w) => ({
      id: randomUUID(),
      jobTitle: w.jobTitle.trim(),
      company: w.company.trim(),
      ...(clean(w.location) ? { location: clean(w.location) } : {}),
      startDate: toMonth(w.startDate) ?? "", // left blank for the user to fill in, never guessed
      endDate: w.isCurrent ? null : (toMonth(w.endDate) ?? null),
      bullets: w.bullets
        .map((b) => b.trim())
        .filter(Boolean)
        .map((b) => ({ id: randomUUID(), text: b })),
    })),
    education: parsed.education.map((e) => {
      const entry: Education = { id: randomUUID(), institution: e.institution.trim(), degree: e.degree.trim() };
      const fieldOfStudy = clean(e.fieldOfStudy);
      if (fieldOfStudy) entry.fieldOfStudy = fieldOfStudy;
      const startDate = toMonth(e.startDate);
      if (startDate) entry.startDate = startDate;
      const endDate = e.inProgress ? null : toMonth(e.endDate);
      if (endDate !== undefined) entry.endDate = endDate;
      return entry;
    }),
    skills: [...new Set(parsed.skills.map((s) => s.trim()).filter(Boolean))],
  };
}
