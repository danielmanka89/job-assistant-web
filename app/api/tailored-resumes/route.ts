import { NextResponse, type NextRequest } from "next/server";
import { apiError, toGeneratedFile, toTailoredResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TailoredResumeListResponse } from "@/lib/types";

/**
 * GET /api/tailored-resumes — the user's tailored resumes, newest first, each with its saved
 * finalMatchPercent and download links for its generated files.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to see your tailored resumes");

  const rows = await prisma.tailoredResume.findMany({
    where: { userId: user.id },
    include: { files: { omit: { data: true }, orderBy: { createdAt: "asc" } } }, // file bytes stay on the server
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json<TailoredResumeListResponse>({
    tailoredResumes: rows.map(({ files, ...row }) => ({
      ...toTailoredResume(row),
      files: files.map((f) => toGeneratedFile(f, row.sourceResumeId)),
    })),
  });
}
