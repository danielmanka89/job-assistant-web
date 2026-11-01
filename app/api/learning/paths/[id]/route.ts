import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roadmapStepIds } from "@/lib/learning-content";
import { toLearningPath } from "@/lib/learning-store";
import type { LearningPath, LearningStatus } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };
const STATUSES: LearningStatus[] = ["interested", "in_progress", "completed"];

/**
 * PATCH /api/learning/paths/:id — { completedSteps?, status? }. Progress is the share of roadmap
 * steps ticked; ticking a step starts the path, and ticking them all completes it.
 */
export async function PATCH(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to update your learning path");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const { id } = await params;
  const row = await prisma.learningPath.findFirst({ where: { id, userId: user.id } });
  if (!row) return apiError(404, "PATH_NOT_FOUND", "That learning path was removed");

  const fieldErrors: Record<string, string> = {};
  const stepIds = roadmapStepIds(row.skillName);
  let completedSteps = Array.isArray(row.completedSteps) ? (row.completedSteps as string[]) : [];
  if (body.completedSteps !== undefined) {
    const steps = body.completedSteps;
    if (!Array.isArray(steps) || steps.some((s) => typeof s !== "string" || !stepIds.includes(s))) {
      fieldErrors.completedSteps = "Must be roadmap step ids for this skill";
    } else completedSteps = [...new Set(steps as string[])];
  }
  let status = row.status as LearningStatus;
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as LearningStatus)) fieldErrors.status = `Use one of: ${STATUSES.join(", ")}`;
    else status = body.status as LearningStatus;
  }
  if (Object.keys(fieldErrors).length) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);

  const progress = Math.round((completedSteps.length / stepIds.length) * 100);
  if (body.completedSteps !== undefined && body.status === undefined) {
    status = progress === 100 ? "completed" : progress > 0 ? "in_progress" : status === "completed" ? "in_progress" : status;
  }
  const updated = await prisma.learningPath.update({ where: { id: row.id }, data: { completedSteps, progress, status } });
  return NextResponse.json<LearningPath>(toLearningPath(updated));
}

/** DELETE /api/learning/paths/:id — stops following a learning path. */
export async function DELETE(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to update your learning path");
  const { id } = await params;
  const { count } = await prisma.learningPath.deleteMany({ where: { id, userId: user.id } });
  if (!count) return apiError(404, "PATH_NOT_FOUND", "That learning path was already removed");
  return new Response(null, { status: 204 });
}
