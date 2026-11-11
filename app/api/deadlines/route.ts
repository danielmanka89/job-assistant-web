import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject, toSubmission } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { customDeadline, isDateString, learningDeadline, submissionDeadlines } from "@/lib/deadlines";
import { toLearningPath } from "@/lib/learning-store";
import type { DeadlineItem, DeadlineListResponse } from "@/lib/types";

const MAX_DEADLINES = 200; // own deadlines per user
const MAX_TITLE = 120;
const RECENT_DONE = 10; // finished own deadlines kept on the Board view's Done column

/**
 * GET /api/deadlines — everything the sidebar's deadline tracker shows: interviews and follow-ups from
 * the Spreadsheet, learning paths in progress, and the user's own deadlines. The page groups them by
 * its own calendar day (lib/deadlines.ts), so nothing here depends on the server's time zone.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your deadlines");

  const [submissions, paths, open, done] = await Promise.all([
    prisma.submission.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.learningPath.findMany({ where: { userId: user.id, status: "in_progress" } }),
    prisma.deadline.findMany({ where: { userId: user.id, done: false }, orderBy: { dueOn: "asc" } }),
    prisma.deadline.findMany({ where: { userId: user.id, done: true }, orderBy: { updatedAt: "desc" }, take: RECENT_DONE }),
  ]);

  const items: DeadlineItem[] = [
    ...submissions.flatMap((row) => submissionDeadlines(toSubmission(row))),
    ...paths.map((row) => learningDeadline(toLearningPath(row))).filter((i): i is DeadlineItem => i !== null),
    ...[...open, ...done].map(customDeadline),
  ];
  return NextResponse.json<DeadlineListResponse>({ items });
}

/** POST /api/deadlines — { title, dueOn: "YYYY-MM-DD" } adds one of the user's own deadlines. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to add a deadline");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "Say what's due";
  else if (title.length > MAX_TITLE) fieldErrors.title = `Keep it under ${MAX_TITLE} characters`;
  if (!isDateString(body.dueOn)) fieldErrors.dueOn = "Pick a due date";
  if (Object.keys(fieldErrors).length) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);

  const count = await prisma.deadline.count({ where: { userId: user.id } });
  if (count >= MAX_DEADLINES) {
    return apiError(409, "TOO_MANY_DEADLINES", `You can keep up to ${MAX_DEADLINES} deadlines. Delete some finished ones first.`);
  }
  const row = await prisma.deadline.create({ data: { userId: user.id, title, dueOn: body.dueOn as string } });
  return NextResponse.json<DeadlineItem>(customDeadline(row), { status: 201 });
}
