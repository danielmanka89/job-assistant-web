import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSend } from "@/lib/email";
import { JD_INCLUDE, detectDetails, readVendorJdInput, toVendorJd } from "@/lib/vendor-jds";
import { MAX_VENDOR_JDS, type VendorJd, type VendorJdListResponse } from "@/lib/types";

export const maxDuration = 60;

/** GET /api/jds — the JDs vendors sent you (My JDs), newest first, each with its tailored resume. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your JDs");

  const rows = await prisma.vendorJd.findMany({
    where: { userId: user.id },
    include: JD_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: MAX_VENDOR_JDS,
  });
  return NextResponse.json<VendorJdListResponse>({ jds: rows.map(toVendorJd), canSendEmail: canSend() });
}

/**
 * POST /api/jds { jobDescription, title?, client?, … } — saves a JD. The role, client, location, rate
 * and vendor details are detected from the text; anything typed in wins over what's detected.
 * The page then asks for the tailored resume (POST /api/jds/:id/tailor).
 */
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

  const jobDescription = data.jobDescription!;
  const detected = await detectDetails(jobDescription);
  const typed = Object.fromEntries(Object.entries(data).filter(([, v]) => v));
  const row = await prisma.vendorJd.create({
    data: { ...detected, ...typed, userId: user.id, jobDescription },
    include: JD_INCLUDE,
  });
  return NextResponse.json<VendorJd>(toVendorJd(row), { status: 201 });
}
