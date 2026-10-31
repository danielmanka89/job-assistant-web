import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

/** Extracts plain text from an uploaded PDF or DOCX. Returns "" if the file has no readable text. */
export async function extractResumeText(bytes: Buffer, fileType: "pdf" | "docx"): Promise<string> {
  let text: string;
  if (fileType === "pdf") {
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    try {
      // No "-- 1 of 2 --" page markers, so a PDF without a text layer comes back empty.
      text = (await parser.getText({ pageJoiner: "" })).text;
    } finally {
      await parser.destroy();
    }
  } else {
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
  }
  // Collapse runs of spaces and blank lines; keep line breaks, which carry structure.
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
