import mammoth from "mammoth";
// Must load before pdf-parse: it defines DOMMatrix (missing in Vercel's Node runtime) and
// points pdf.js at a worker file that exists in the deployed function.
import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

PDFParse.setWorker(getPath());

/**
 * Extracts plain text from an uploaded PDF or DOCX. Returns "" if the file has no readable text.
 * With links, link targets are kept: resumes often show "LinkedIn" as a link whose address isn't in
 * the visible text. PDF links come back inline as [text](url); DOCX links are listed at the end.
 */
export async function extractResumeText(bytes: Buffer, fileType: "pdf" | "docx", { links = false } = {}): Promise<string> {
  let text: string;
  if (fileType === "pdf") {
    const parser = new PDFParse({ data: new Uint8Array(bytes) });
    try {
      // No "-- 1 of 2 --" page markers, so a PDF without a text layer comes back empty.
      text = (await parser.getText({ pageJoiner: "", parseHyperlinks: links })).text;
    } finally {
      await parser.destroy();
    }
  } else {
    text = (await mammoth.extractRawText({ buffer: bytes })).value;
    if (links && text.trim()) {
      const html = (await mammoth.convertToHtml({ buffer: bytes })).value;
      const urls = [...new Set([...html.matchAll(/<a href="(https?:\/\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))];
      if (urls.length) text += `\n\nLinks in this document:\n${urls.join("\n")}`;
    }
  }
  // Collapse runs of spaces and blank lines; keep line breaks, which carry structure.
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}
