import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { parseResumeText, ResumeParseError, type ParsedResume } from "@/lib/ai";
import { apiError, toResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractResumeText } from "@/lib/resume-text";
import type { Resume, ResumeContact } from "@/lib/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_TEXT_CHARS = 100_000; // well beyond any real resume; rejected rather than truncated

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
  const user = await getSessionUser(request);
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

  let text: string;
  try {
    text = await extractResumeText(bytes, fileType);
  } catch (error) {
    console.error("text extraction failed", error);
    text = "";
  }
  if (!text) {
    return apiError(422, "PARSE_FAILED", "We couldn't read any text in this file. Scanned PDFs aren't supported yet.", {
      file: "Upload a PDF or DOCX that contains selectable text",
    });
  }
  if (text.length > MAX_TEXT_CHARS) {
    return apiError(422, "RESUME_TOO_LONG", "This file has more text than a resume usually does", {
      file: "Upload a resume of a few pages",
    });
  }

  let parsed: ParsedResume;
  try {
    parsed = await parseResumeText(text);
  } catch (error) {
    console.error("resume parsing failed", error);
    if (error instanceof ResumeParseError && error.reason === "unreadable") {
      return apiError(422, "PARSE_FAILED", "We couldn't read this resume. Try exporting it again as PDF or DOCX.");
    }
    if (error instanceof ResumeParseError && error.reason === "not_configured") {
      return apiError(503, "AI_NOT_CONFIGURED", "Resume parsing isn't set up on this server yet.");
    }
    return apiError(502, "AI_UNAVAILABLE", "Resume parsing is temporarily unavailable. Please try again.");
  }

  // Name and email fall back to the account when the document doesn't include them.
  const contact: ResumeContact = {
    ...parsed.contact,
    fullName: parsed.contact.fullName ?? user.name,
    email: parsed.contact.email ?? user.email,
  };

  const storedFileName = `${randomUUID()}.${fileType}`;
  const userDir = path.join(UPLOAD_DIR, user.id);
  const filePath = path.join(userDir, storedFileName);

  try {
    await mkdir(userDir, { recursive: true });
    await writeFile(filePath, bytes);

    const resume = await prisma.resume.create({
      data: {
        userId: user.id,
        sourceFileName: path.basename(file.name),
        storedFileName,
        mimeType: FILE_TYPES[fileType].mimeType,
        fileSize: bytes.length,
        contact: { ...contact },
        summary: parsed.summary ?? null,
        workExperience: parsed.workExperience as object[],
        education: parsed.education as object[],
        skills: parsed.skills,
      },
    });
    return NextResponse.json<Resume>(toResume(resume), { status: 201 });
  } catch (error) {
    await rm(filePath, { force: true });
    console.error("upload failed", error);
    return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
