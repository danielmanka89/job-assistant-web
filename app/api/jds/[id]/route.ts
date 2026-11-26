import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JD_INCLUDE, readVendorJdInput, toVendorJd } from "@/lib/vendor-jds";
import type { VendorJd } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

/** PATCH /api/jds/:id — changes the given fields. A new description unlinks the old tailored resume. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to edit this JD");
  const { id } = await params;

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const { data, fieldErrors } = readVendorJdInput(body, false);
  if (Object.keys(fieldErrors).length) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);

  const current = await prisma.vendorJd.findFirst({ where: { id, userId: user.id }, select: { jobDescription: true } });
  if (!current) return apiError(404, "JD_NOT_FOUND", "That JD isn't saved anymore");
  const descriptionChanged = data.jobDescription !== undefined && data.jobDescription !== current.jobDescription;

  const row = await prisma.vendorJd.update({
    where: { id },
    data: { ...data, ...(descriptionChanged ? { tailoredResumeId: null } : {}) },
    include: JD_INCLUDE,
  });
  return NextResponse.json<VendorJd>(toVendorJd(row));
}

/** DELETE /api/jds/:id — removes the JD. Its tailored resume and Spreadsheet row stay. */
export async function DELETE(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to delete this JD");
  const { id } = await params;

  const { count } = await prisma.vendorJd.deleteMany({ where: { id, userId: user.id } });
  if (!count) return apiError(404, "JD_NOT_FOUND", "That JD isn't saved anymore");
  return new NextResponse(null, { status: 204 });
}
