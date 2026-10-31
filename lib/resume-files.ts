import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from "docx";
import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Education, TailoredResume, WorkExperience } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2021-03" -> "Mar 2021"; empty or malformed values are left out. */
function formatMonth(value: string | null | undefined): string {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : "";
}

function dateRange(start: string | null | undefined, end: string | null | undefined, openLabel: string): string {
  const from = formatMonth(start);
  const to = end === null ? openLabel : formatMonth(end);
  return [from, to].filter(Boolean).join(" – ");
}

const jobDates = (w: WorkExperience) => dateRange(w.startDate, w.endDate, "Present");
const educationDates = (e: Education) => dateRange(e.startDate, e.endDate, "In progress");
const educationTitle = (e: Education) => [e.degree, e.fieldOfStudy].filter(Boolean).join(", ");

function contactLine(resume: TailoredResume): string {
  const { email, phone, location, linkedinUrl, websiteUrl } = resume.contact;
  return [email, phone, location, linkedinUrl, websiteUrl].filter(Boolean).join("  |  ");
}

/** "Jane Doe" -> "Jane_Doe_Resume.pdf"; letters from any alphabet are kept. */
export function resumeFileName(fullName: string, format: "docx" | "pdf"): string {
  const base = fullName.normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
  return `${base || "Tailored"}_Resume.${format}`;
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22 })],
  });
}

/** Title on the left, dates right-aligned on the same line. */
function titleLine(title: string, detail: string, dates: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: title, bold: true }),
      ...(detail ? [new TextRun({ text: `, ${detail}` })] : []),
      ...(dates ? [new TextRun({ text: `\t${dates}`, color: "555555" })] : []),
    ],
  });
}

export async function renderDocx(resume: TailoredResume): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: resume.contact.fullName, bold: true, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: contactLine(resume), size: 18, color: "555555" })],
    }),
  ];

  if (resume.summary) {
    children.push(sectionHeading("Summary"), new Paragraph({ children: [new TextRun(resume.summary)] }));
  }
  if (resume.workExperience.length) {
    children.push(sectionHeading("Experience"));
    for (const w of resume.workExperience) {
      children.push(titleLine(w.jobTitle, [w.company, w.location].filter(Boolean).join(", "), jobDates(w)));
      for (const b of w.bullets) children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(b.text)] }));
    }
  }
  if (resume.education.length) {
    children.push(sectionHeading("Education"));
    for (const e of resume.education) children.push(titleLine(educationTitle(e), e.institution, educationDates(e)));
  }
  if (resume.skills.length) {
    children.push(sectionHeading("Skills"), new Paragraph({ children: [new TextRun(resume.skills.join(", "))] }));
  }

  const doc = new Document({
    creator: resume.contact.fullName,
    title: `${resume.contact.fullName} – Resume`,
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }],
  });
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const PAGE = { width: 595.28, height: 841.89, margin: 54 }; // A4, 0.75in margins
const GRAY = rgb(0.33, 0.33, 0.33);

// DejaVu Sans (Bitstream Vera license, free to embed) covers Latin, Greek, Cyrillic and many other
// scripts. It ships as an npm package, so no font files live in the repo.
const FONT_DIR = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");

interface PdfFonts {
  regular: Uint8Array;
  bold: Uint8Array;
  /** True when both faces have a glyph for the code point. */
  covers: (codePoint: number) => boolean;
}

let fonts: PdfFonts | undefined;

function loadFonts(): PdfFonts {
  if (!fonts) {
    const regular = readFileSync(path.join(FONT_DIR, "DejaVuSans.ttf"));
    const bold = readFileSync(path.join(FONT_DIR, "DejaVuSans-Bold.ttf"));
    const faces = [fontkit.create(regular), fontkit.create(bold)];
    fonts = { regular, bold, covers: (cp) => faces.every((f) => f.hasGlyphForCodePoint(cp)) };
  }
  return fonts;
}

// Last-resort replacements for characters the font lacks; most are already covered by DejaVu.
const LATIN_FALLBACKS: Record<string, string> = {
  Ł: "L", ł: "l", Ø: "O", ø: "o", Đ: "D", đ: "d", Ħ: "H", ħ: "h", ı: "i", Ŧ: "T", ŧ: "t", Ŀ: "L", ŀ: "l",
  "‐": "-", "‑": "-", "−": "-", " ": " ", " ": " ", // hyphens, minus, no-break spaces
};

/** Simple top-to-bottom text layout with word wrap and page breaks. */
class PdfWriter {
  private page: PDFPage;
  private y: number;
  private readonly safe = new Map<string, string>();

  constructor(
    private readonly doc: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
    private readonly covers: (codePoint: number) => boolean,
  ) {
    this.page = doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - PAGE.margin;
  }

  /**
   * Keeps every character the embedded font can draw. Anything it can't (mainly CJK and emoji) falls
   * back to a plain-letter equivalent, or "?" as a last resort, instead of an empty box. The .docx keeps them all.
   */
  private encodable(text: string): string {
    let out = "";
    for (const ch of text) {
      let safe = this.safe.get(ch);
      if (safe === undefined) {
        const drawable = (s: string) => [...s].every((c) => /\s/.test(c) || this.covers(c.codePointAt(0)!));
        safe = [ch, LATIN_FALLBACKS[ch] ?? "", ch.normalize("NFKD").replace(/\p{M}/gu, ""), "?"].find(
          (c) => c !== "" && drawable(c),
        )!;
        this.safe.set(ch, safe);
      }
      out += safe;
    }
    return out;
  }

  private ensureSpace(height: number) {
    if (this.y - height < PAGE.margin) {
      this.page = this.doc.addPage([PAGE.width, PAGE.height]);
      this.y = PAGE.height - PAGE.margin;
    }
  }

  private wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  gap(points: number) {
    this.y -= points;
  }

  text(raw: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; center?: boolean } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? this.bold : this.regular;
    const indent = opts.indent ?? 0;
    const width = PAGE.width - 2 * PAGE.margin - indent;
    for (const line of this.wrap(this.encodable(raw), font, size, width)) {
      this.ensureSpace(size * 1.35);
      this.y -= size * 1.35;
      const x = opts.center ? (PAGE.width - font.widthOfTextAtSize(line, size)) / 2 : PAGE.margin + indent;
      this.page.drawText(line, { x, y: this.y, size, font, color: opts.color ?? rgb(0, 0, 0) });
    }
  }

  bullet(raw: string) {
    this.ensureSpace(14);
    const marker = this.y - 10.5 * 1.35;
    this.page.drawText("•", { x: PAGE.margin + 4, y: marker, size: 10.5, font: this.regular });
    this.text(raw, { indent: 16 });
  }

  /** Bold title (+ regular detail) on the left, gray dates right-aligned on the same line. */
  titleLine(title: string, detail: string, dates: string) {
    const size = 10.5;
    this.gap(5);
    this.ensureSpace(size * 1.35);
    this.y -= size * 1.35;
    const t = this.encodable(title);
    const d = detail ? this.encodable(`, ${detail}`) : "";
    const r = this.encodable(dates);
    const datesWidth = this.regular.widthOfTextAtSize(r, size);
    this.page.drawText(t, { x: PAGE.margin, y: this.y, size, font: this.bold });
    this.page.drawText(d, { x: PAGE.margin + this.bold.widthOfTextAtSize(t, size), y: this.y, size, font: this.regular });
    if (r) this.page.drawText(r, { x: PAGE.width - PAGE.margin - datesWidth, y: this.y, size, font: this.regular, color: GRAY });
  }

  heading(label: string) {
    this.gap(10);
    this.text(label.toUpperCase(), { size: 11, bold: true });
    this.gap(2);
    this.page.drawLine({
      start: { x: PAGE.margin, y: this.y },
      end: { x: PAGE.width - PAGE.margin, y: this.y },
      thickness: 0.6,
      color: rgb(0.6, 0.6, 0.6),
    });
    this.gap(2);
  }
}

export async function renderPdf(resume: TailoredResume): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${resume.contact.fullName} – Resume`);
  doc.setAuthor(resume.contact.fullName);
  doc.registerFontkit(fontkit);
  const { regular, bold, covers } = loadFonts();
  // subset: only the characters used are embedded, which keeps files small.
  const pdf = new PdfWriter(doc, await doc.embedFont(regular, { subset: true }), await doc.embedFont(bold, { subset: true }), covers);

  pdf.text(resume.contact.fullName, { size: 18, bold: true, center: true });
  pdf.text(contactLine(resume), { size: 9, color: GRAY, center: true });

  if (resume.summary) {
    pdf.heading("Summary");
    pdf.text(resume.summary);
  }
  if (resume.workExperience.length) {
    pdf.heading("Experience");
    for (const w of resume.workExperience) {
      pdf.titleLine(w.jobTitle, [w.company, w.location].filter(Boolean).join(", "), jobDates(w));
      for (const b of w.bullets) pdf.bullet(b.text);
    }
  }
  if (resume.education.length) {
    pdf.heading("Education");
    for (const e of resume.education) pdf.titleLine(educationTitle(e), e.institution, educationDates(e));
  }
  if (resume.skills.length) {
    pdf.heading("Skills");
    pdf.text(resume.skills.join(", "));
  }

  return Buffer.from(await doc.save());
}
