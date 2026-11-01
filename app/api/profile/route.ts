import { NextResponse, type NextRequest } from "next/server";
import type { User as UserRow } from "@/lib/generated/prisma/client";
import { apiError, readJsonObject, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { profileSuggestions, validateProfile } from "@/lib/profile";
import type { ProfileResponse, ProfileValues } from "@/lib/types";

async function suggestionsFor(user: UserRow): Promise<ProfileValues> {
  const resume = await prisma.resume.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  return profileSuggestions(user, resume ? toResume(resume) : null);
}

/**
 * GET /api/profile — the job seeker's saved profile. Until it is first saved (updatedAt null),
 * suggestions from the account and latest resume are included to fill the form.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your profile");

  const row = await prisma.candidateProfile.findUnique({ where: { userId: user.id } });
  return NextResponse.json<ProfileResponse>({
    values: (row?.values as ProfileValues | undefined) ?? {},
    updatedAt: row?.updatedAt.toISOString() ?? null,
    suggestions: row ? {} : await suggestionsFor(user),
  });
}

/** PUT /api/profile — saves the whole profile ({ values }). Blank or missing fields are cleared. */
export async function PUT(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to save your profile");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const { values, fieldErrors } = validateProfile(body.values);
  if (Object.keys(fieldErrors).length) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);
  }

  const row = await prisma.candidateProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, values },
    update: { values },
  });
  return NextResponse.json<ProfileResponse>({ values, updatedAt: row.updatedAt.toISOString(), suggestions: {} });
}
