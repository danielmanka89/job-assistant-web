import mammoth from "mammoth";
// Must load before pdf-parse: it defines DOMMatrix (missing in Vercel's Node runtime) and
// points pdf.js at a worker file that exists in the deployed function.
import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

PDFParse.setWorker(getPath());

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
