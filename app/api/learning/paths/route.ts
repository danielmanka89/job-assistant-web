import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toLearningPath } from "@/lib/learning-store";
import type { LearningPath } from "@/lib/types";

const MAX_PATHS = 50;

/** POST /api/learning/paths — { skills: string[] } starts learning paths; existing ones are kept. Returns all paths. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to start a learning path");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const skills = Array.isArray(body.skills) ? [...new Set(body.skills.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean))] : [];
  if (!skills.length || skills.length > 10 || skills.some((s) => s.length > 60)) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { skills: "Send 1–10 skill names of up to 60 characters" });
  }

  const count = await prisma.learningPath.count({ where: { userId: user.id } });
  if (count + skills.length > MAX_PATHS) {
    return apiError(409, "TOO_MANY_PATHS", `You can follow up to ${MAX_PATHS} learning paths. Remove some first.`);
  }

  await prisma.learningPath.createMany({ data: skills.map((skillName) => ({ userId: user.id, skillName })), skipDuplicates: true });
  const rows = await prisma.learningPath.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json<LearningPath[]>(rows.map(toLearningPath), { status: 201 });
}
