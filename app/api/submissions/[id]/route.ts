import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject, toSubmission } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SHEETS, validateSheetValues } from "@/lib/spreadsheet";
import type { SheetValues, Submission, UpdateSubmissionRequest } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

/**
 * PATCH /api/submissions/:id — changes cells, e.g. { "vendor": { "vendorCompany": "Acme" } }.
 * Cells not in the body keep their value; "" clears a cell.
 */
export async function PATCH(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to edit your spreadsheet");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const fieldErrors: Record<string, string> = {};
  for (const key of Object.keys(body)) {
    if (!SHEETS.some((s) => s.key === key)) fieldErrors[key] = "Unknown sheet";
  }
  const changes: UpdateSubmissionRequest = {};
  for (const sheet of SHEETS) {
    if (body[sheet.key] === undefined) continue;
    const result = validateSheetValues(sheet, body[sheet.key]);
    Object.assign(fieldErrors, result.fieldErrors);
    changes[sheet.key] = result.values;
  }
  if (Object.keys(fieldErrors).length) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted cells", fieldErrors);
  }

  const { id } = await params;
  const row = await prisma.submission.findFirst({ where: { id, userId: user.id } });
  if (!row) return apiError(404, "SUBMISSION_NOT_FOUND", "That row was deleted");

  const current = toSubmission(row);
  const data: Partial<Record<keyof UpdateSubmissionRequest, SheetValues>> = {};
  for (const [key, values] of Object.entries(changes) as [keyof UpdateSubmissionRequest, SheetValues][]) {
    const merged = { ...current[key], ...values };
    for (const [column, value] of Object.entries(merged)) if (!value) delete merged[column]; // "" clears
    data[key] = merged;
  }

  const updated = await prisma.submission.update({ where: { id: row.id }, data });
  return NextResponse.json<Submission>(toSubmission(updated));
}

/** DELETE /api/submissions/:id — removes the row from every sheet. */
export async function DELETE(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to edit your spreadsheet");

  const { id } = await params;
  const { count } = await prisma.submission.deleteMany({ where: { id, userId: user.id } });
  if (!count) return apiError(404, "SUBMISSION_NOT_FOUND", "That row was already deleted");
  return new Response(null, { status: 204 });
}
