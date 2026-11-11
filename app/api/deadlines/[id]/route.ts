import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { customDeadline } from "@/lib/deadlines";
import type { DeadlineItem } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/deadlines/:id — { done } ticks one of the user's own deadlines off (or back on). */
export async function PATCH(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to update your deadlines");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  if (typeof body.done !== "boolean") return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", { done: "Must be true or false" });

  const { id } = await params;
  const { count } = await prisma.deadline.updateMany({ where: { id, userId: user.id }, data: { done: body.done } });
  if (!count) return apiError(404, "DEADLINE_NOT_FOUND", "That deadline was removed");
  const row = await prisma.deadline.findUniqueOrThrow({ where: { id } });
  return NextResponse.json<DeadlineItem>(customDeadline(row));
}

/** DELETE /api/deadlines/:id — removes one of the user's own deadlines. */
export async function DELETE(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to update your deadlines");
  const { id } = await params;
  const { count } = await prisma.deadline.deleteMany({ where: { id, userId: user.id } });
  if (!count) return apiError(404, "DEADLINE_NOT_FOUND", "That deadline was already removed");
  return new Response(null, { status: 204 });
}
