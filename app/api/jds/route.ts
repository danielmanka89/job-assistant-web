import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSend } from "@/lib/email";
import { readVendorJdInput, toVendorJds } from "@/lib/vendor-jds";
import { MAX_VENDOR_JDS, type VendorJd, type VendorJdListResponse } from "@/lib/types";

/** GET /api/jds — the JDs vendors sent you (My JDs), newest first, each with its tailored resume if any. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your JDs");

  const rows = await prisma.vendorJd.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: MAX_VENDOR_JDS });
  return NextResponse.json<VendorJdListResponse>({ jds: await toVendorJds(user.id, rows), canSendEmail: canSend() });
}

/** POST /api/jds { jobDescription, title?, client?, … } — saves a JD. A missing title is read from the text. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to save a JD");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");
  const { data, fieldErrors } = readVendorJdInput(body, true);
  if (Object.keys(fieldErrors).length) return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);

  const count = await prisma.vendorJd.count({ where: { userId: user.id } });
  if (count >= MAX_VENDOR_JDS) {
    return apiError(409, "TOO_MANY_JDS", `You can keep up to ${MAX_VENDOR_JDS} JDs. Delete some old ones first.`);
  }

  const row = await prisma.vendorJd.create({
    data: { ...data, userId: user.id, title: data.title!, jobDescription: data.jobDescription! },
  });
  const [jd] = await toVendorJds(user.id, [row]);
  return NextResponse.json<VendorJd>(jd, { status: 201 });
}
