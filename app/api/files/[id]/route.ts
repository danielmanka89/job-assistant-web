import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const TAILORED_DIR = path.join(process.cwd(), "uploads", "tailored");

type Context = { params: Promise<{ id: string }> };

/** GET /api/files/:id — downloads one of the logged-in user's generated resume files. */
export async function GET(request: NextRequest, { params }: Context) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to download this file");

  const { id } = await params;
  const file = await prisma.generatedFile.findFirst({ where: { id, userId: user.id }, omit: { data: false } });
  if (!file) return apiError(404, "FILE_NOT_FOUND", "File not found");

  // Files generated before they were stored in the database are still on local disk.
  let bytes: Uint8Array;
  if (file.data) {
    bytes = file.data;
  } else {
    try {
      bytes = await readFile(path.join(TAILORED_DIR, user.id, path.basename(file.storedFileName)));
    } catch {
      return apiError(404, "FILE_NOT_FOUND", "File not found");
    }
  }

  const asciiName = file.fileName.replace(/[^\x20-\x7e]|"/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
