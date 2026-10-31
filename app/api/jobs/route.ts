import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject, toJobPosting } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncExternalJobs } from "@/lib/job-providers";
import type { CreateJobPostingRequest, JobListResponse, JobPosting, JobSource } from "@/lib/types";

const SOURCES: JobSource[] = ["native", "adzuna", "mock"];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * GET /api/jobs — native and external jobs, newest first. Public.
 * Optional query: q (search title, company, location, description), source, limit (1-100).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const source = params.get("source");
  const limitParam = params.get("limit");
  const limit = limitParam === null ? DEFAULT_LIMIT : Number(limitParam);

  const fieldErrors: Record<string, string> = {};
  if (source !== null && !SOURCES.includes(source as JobSource)) fieldErrors.source = `Use one of: ${SOURCES.join(", ")}`;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) fieldErrors.limit = `Use a whole number from 1 to ${MAX_LIMIT}`;
  if (q.length > 200) fieldErrors.q = "Search text must be 200 characters or fewer";
  if (Object.keys(fieldErrors).length) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the search parameters", fieldErrors);
  }

  await syncExternalJobs(); // never throws; a failed provider just means fewer jobs

  const jobs = await prisma.jobPosting.findMany({
    where: {
      ...(source ? { source } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { company: { contains: q } },
              { location: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json<JobListResponse>({ jobs: jobs.map(toJobPosting) });
}

const LIMITS = { title: 200, company: 200, location: 200, applyUrl: 2000 } as const;
const MIN_DESCRIPTION = 50;
const MAX_DESCRIPTION = 20_000; // same limits as gap analysis, so any posting can be analyzed

/** Returns per-field errors for a job posting body, or the cleaned request if valid. */
function validate(body: Record<string, unknown>): { fieldErrors: Record<string, string> } | { data: CreateJobPostingRequest } {
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");
  const data: CreateJobPostingRequest = {
    title: text("title"),
    company: text("company"),
    location: text("location"),
    description: text("description"),
    applyUrl: text("applyUrl"),
  };
  const fieldErrors: Record<string, string> = {};

  for (const key of ["title", "company", "location"] as const) {
    if (!data[key]) fieldErrors[key] = "Required";
    else if (data[key].length > LIMITS[key]) fieldErrors[key] = `Must be ${LIMITS[key]} characters or fewer`;
  }
  if (data.description.length < MIN_DESCRIPTION) {
    fieldErrors.description = `Add the full job description (at least ${MIN_DESCRIPTION} characters)`;
  } else if (data.description.length > MAX_DESCRIPTION) {
    fieldErrors.description = `Must be ${MAX_DESCRIPTION.toLocaleString("en-US")} characters or fewer`;
  }

  // Only web links: a javascript: or data: URL rendered as an "Apply" link would run in the reader's browser.
  let url: URL | null = null;
  try {
    url = new URL(data.applyUrl);
  } catch {
    // reported below
  }
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
    fieldErrors.applyUrl = "Enter a full link starting with https://";
  } else if (data.applyUrl.length > LIMITS.applyUrl) {
    fieldErrors.applyUrl = `Must be ${LIMITS.applyUrl} characters or fewer`;
  }

  return Object.keys(fieldErrors).length ? { fieldErrors } : { data };
}

/** POST /api/jobs — posts a job on the site. Requires login; the poster is recorded. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to post a job");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const result = validate(body);
  if ("fieldErrors" in result) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", result.fieldErrors);
  }

  try {
    const job = await prisma.jobPosting.create({
      data: { ...result.data, source: "native", postedById: user.id },
    });
    return NextResponse.json<JobPosting>(toJobPosting(job), { status: 201 });
  } catch (error) {
    console.error("posting job failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
