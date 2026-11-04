import { readFile } from "node:fs/promises";
import path from "node:path";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

type Context = { params: Promise<{ userId: string }> };

/**
 * GET /api/profile/public/:userId/resume — downloads the original resume file behind a public
 * portfolio (the latest upload). No login needed; 404 unless the candidate approved sharing.
 */
export async function GET(_request: Request, { params }: Context) {
  const { userId } = await params;
  const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { publishedAt: true } });
  if (!profile?.publishedAt) return apiError(404, "PORTFOLIO_NOT_FOUND", "This portfolio isn't public");

  const resume = await prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, omit: { data: false } });
  if (!resume) return apiError(404, "FILE_NOT_FOUND", "No resume file to download");

  // Resumes uploaded before files were stored in the database are still on local disk.
  let bytes: Uint8Array;
  if (resume.data) {
    bytes = resume.data;
  } else {
    try {
      bytes = await readFile(path.join(UPLOAD_DIR, path.basename(resume.storedFileName)));
    } catch {
      return apiError(404, "FILE_NOT_FOUND", "No resume file to download");
    }
  }

  const fileName = resume.sourceFileName || `Resume${resume.mimeType === "application/pdf" ? ".pdf" : ".docx"}`;
  const asciiName = fileName.replace(/[^\x20-\x7e]|"/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": resume.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
