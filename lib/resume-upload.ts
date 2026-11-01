import path from "node:path";
import type { NextResponse } from "next/server";
import type { User as UserRow } from "@/lib/generated/prisma/client";
import { parseResumeText } from "@/lib/ai";
import { aiErrorResponse, apiError } from "@/lib/api";
import { extractResumeText } from "@/lib/resume-text";
import type { ApiError, ResumeContact, ResumeDraft } from "@/lib/types";

// Reading and parsing an uploaded resume file, shared by POST /api/resume/compare and
// /api/resume/confirm-sync. Resumes are only saved through confirm-sync, so the profile always
// matches the latest resume.

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 100_000; // well beyond any real resume; rejected rather than truncated

export const FILE_TYPES = {
  pdf: { mimeType: "application/pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // "%PDF"
  docx: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    magic: [0x50, 0x4b, 0x03, 0x04], // ZIP container
  },
} as const;
export type ResumeFileType = keyof typeof FILE_TYPES;

export interface UploadedFile {
  name: string; // base name only
  bytes: Buffer;
  fileType: ResumeFileType;
}

type Failure = { error: NextResponse<ApiError> };

/** Detects PDF or DOCX from the file extension and its leading bytes; null if neither. */
function detectFileType(fileName: string, bytes: Buffer): ResumeFileType | null {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  if (ext !== "pdf" && ext !== "docx") return null;
  const { magic } = FILE_TYPES[ext];
  return magic.every((byte, i) => bytes[i] === byte) ? ext : null;
}

/** Reads the multipart body and checks the "file" field is a PDF or DOCX of at most 10 MB. */
export async function readResumeUpload(request: Request): Promise<(Failure & { form?: never }) | { file: UploadedFile; form: FormData }> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_FILE_BYTES + 64 * 1024) {
    return { error: apiError(413, "FILE_TOO_LARGE", "File must be 10 MB or smaller", { file: "File must be 10 MB or smaller" }) };
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { error: apiError(400, "INVALID_FORM_DATA", 'Send the resume as multipart/form-data in a field named "file"') };
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: apiError(400, "VALIDATION_ERROR", "Please choose a resume file", { file: "A PDF or DOCX file is required" }) };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: apiError(413, "FILE_TOO_LARGE", "File must be 10 MB or smaller", { file: "File must be 10 MB or smaller" }) };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileType = detectFileType(file.name, bytes);
  if (!fileType) {
    return {
      error: apiError(415, "UNSUPPORTED_FILE", "Only PDF and DOCX files are supported", { file: "Upload a .pdf or .docx file" }),
    };
  }
  return { file: { name: path.basename(file.name), bytes, fileType }, form };
}

/** Extracts the text and parses it with the AI. Name and email fall back to the account. */
export async function parseResumeUpload(file: UploadedFile, user: Pick<UserRow, "name" | "email">): Promise<Failure | { draft: ResumeDraft }> {
  let text: string;
  try {
    text = await extractResumeText(file.bytes, file.fileType);
  } catch (error) {
    console.error("text extraction failed", error);
    text = "";
  }
  if (!text) {
    return {
      error: apiError(422, "PARSE_FAILED", "We couldn't read any text in this file. Scanned PDFs aren't supported yet.", {
        file: "Upload a PDF or DOCX that contains selectable text",
      }),
    };
  }
  if (text.length > MAX_TEXT_CHARS) {
    return {
      error: apiError(422, "RESUME_TOO_LONG", "This file has more text than a resume usually does", { file: "Upload a resume of a few pages" }),
    };
  }

  try {
    const parsed = await parseResumeText(text);
    const contact: ResumeContact = {
      ...parsed.contact,
      fullName: parsed.contact.fullName ?? user.name,
      email: parsed.contact.email ?? user.email,
    };
    return {
      draft: {
        sourceFileName: file.name,
        contact,
        ...(parsed.summary ? { summary: parsed.summary } : {}),
        workExperience: parsed.workExperience,
        education: parsed.education,
        skills: parsed.skills,
      },
    };
  } catch (error) {
    console.error("resume parsing failed", error);
    return {
      error: aiErrorResponse(error, { code: "PARSE_FAILED", message: "We couldn't read this resume. Try exporting it again as PDF or DOCX." }),
    };
  }
}
