import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, toResume } from "@/lib/api";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import type { Resume, ResumeContact } from "@/lib/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const FILE_TYPES = {
  pdf: { mimeType: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // "%PDF"
  docx: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    magic: [0x50, 0x4b, 0x03, 0x04], // ZIP container
  },
} as const;

/** Detects PDF or DOCX from the file extension and its leading bytes; null if neither. */
function detectFileType(fileName: string, bytes: Buffer): keyof typeof FILE_TYPES | null {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  if (ext !== "pdf" && ext !== "docx") return null;
  const { magic } = FILE_TYPES[ext];
  return magic.every((byte, i) => bytes[i] === byte) ? ext : null;
}

export async function POST(request: NextRequest) {
  const userId = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to upload a resume");

  if (Number(request.headers.get("content-length") ?? 0) > MAX_FILE_BYTES + 64 * 1024) {
    return apiError(413, "FILE_TOO_LARGE", "File must be 10 MB or smaller", { file: "File must be 10 MB or smaller" });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return apiError(400, "INVALID_FORM_DATA", "Send the resume as multipart/form-data in a field named \"file\"");
  }
  if (!(file instanceof File) || file.size === 0) {
    return apiError(400, "VALIDATION_ERROR", "Please choose a resume file", { file: "A PDF or DOCX file is required" });
  }
  if (file.size > MAX_FILE_BYTES) {
    return apiError(413, "FILE_TOO_LARGE", "File must be 10 MB or smaller", { file: "File must be 10 MB or smaller" });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileType = detectFileType(file.name, bytes);
  if (!fileType) {
    return apiError(415, "UNSUPPORTED_FILE", "Only PDF and DOCX files are supported", {
      file: "Upload a .pdf or .docx file",
    });
  }

  const storedFileName = `${randomUUID()}.${fileType}`;
  const userDir = path.join(UPLOAD_DIR, user.id);
  const filePath = path.join(userDir, storedFileName);

  try {
    await mkdir(userDir, { recursive: true });
    await writeFile(filePath, bytes);

    // Resume parsing comes in a later phase; until then, contact is prefilled from the account.
    const contact: ResumeContact = { fullName: user.name, email: user.email };
    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        sourceFileName: path.basename(file.name),
        storedFileName,
        mimeType: FILE_TYPES[fileType].mimeType,
        fileSize: bytes.length,
        contact: { ...contact },
        workExperience: [],
        education: [],
        skills: [],
      },
    });
    return NextResponse.json<Resume>(toResume(resume), { status: 201 });
  } catch (error) {
    await rm(filePath, { force: true });
    console.error("upload failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
