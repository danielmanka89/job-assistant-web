import type { NextRequest } from "next/server";
import { apiError, toSubmission } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildSubmissionWorkbook, workbookFileName } from "@/lib/spreadsheet";
import { XLSX_MIME } from "@/lib/xlsx";

/** GET /api/submissions/export — the Spreadsheet as an .xlsx file with one worksheet per sheet. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to download your spreadsheet");

  const rows = await prisma.submission.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const bytes = await buildSubmissionWorkbook(rows.map(toSubmission), request.nextUrl.origin);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${workbookFileName()}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
