import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonObject, toGeneratedFile, toResume, toTailoredResume } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withProfile } from "@/lib/profile";
import { getProfileValues } from "@/lib/profile-store";
import { renderDocx, renderPdf, resumeFileName } from "@/lib/resume-files";
import { extractResumeText } from "@/lib/resume-text";
import { scoreText } from "@/lib/skills";
import { mergeAcceptedBullets } from "@/lib/tailor";
import type { SuggestedBullet, TailoredResume, TailoredResumeResponse } from "@/lib/types";

const FORMATS = {
  docx: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", render: renderDocx },
  pdf: { mimeType: "application/pdf", render: renderPdf },
} as const;
type Format = keyof typeof FORMATS;

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * POST /api/tailor — merges the accepted suggestions from a gap analysis into the resume (with the
 * user's saved profile applied: its contact details and skills),
 * stores the TailoredResume, and renders the requested .docx / .pdf files.
 * The job description comes from the stored analysis; a jobDescription in the body is ignored.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return apiError(401, "UNAUTHORIZED", "Please log in to create a tailored resume");

  const body = await readJsonObject(request);
  if (!body) return apiError(400, "INVALID_JSON", "Request body must be a JSON object");

  const resumeId = typeof body.resumeId === "string" ? body.resumeId : "";
  const gapAnalysisId = typeof body.gapAnalysisId === "string" ? body.gapAnalysisId : "";
  const fieldErrors: Record<string, string> = {};
  if (!resumeId) fieldErrors.resumeId = "Required";
  if (!gapAnalysisId) fieldErrors.gapAnalysisId = "Required";
  if (!isStringArray(body.acceptedBulletIds)) fieldErrors.acceptedBulletIds = "Must be a list of suggestion ids";
  const formats = isStringArray(body.formats) ? [...new Set(body.formats)] : [];
  if (!formats.length || formats.some((f) => !(f in FORMATS))) fieldErrors.formats = 'Choose "docx", "pdf" or both';
  if (Object.keys(fieldErrors).length) {
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields", fieldErrors);
  }
  const acceptedBulletIds = [...new Set(body.acceptedBulletIds as string[])];

  const analysis = await prisma.gapAnalysis.findFirst({ where: { id: gapAnalysisId, userId: user.id } });
  if (!analysis) return apiError(404, "ANALYSIS_NOT_FOUND", "Gap analysis not found");
  if (analysis.resumeId !== resumeId) {
    return apiError(400, "VALIDATION_ERROR", "This analysis was made for a different resume", {
      resumeId: "Doesn't match the gap analysis",
    });
  }
  const resumeRow = await prisma.resume.findFirst({ where: { id: resumeId, userId: user.id } });
  if (!resumeRow) return apiError(404, "RESUME_NOT_FOUND", "Resume not found");

  // Only suggestions from this analysis can be accepted; their text comes from the database.
  const suggestions = analysis.suggestedBullets as unknown as SuggestedBullet[];
  const unknownIds = acceptedBulletIds.filter((id) => !suggestions.some((s) => s.id === id));
  if (unknownIds.length) {
    return apiError(400, "VALIDATION_ERROR", "Some selected suggestions aren't part of this analysis", {
      acceptedBulletIds: `Unknown suggestion ids: ${unknownIds.join(", ")}`,
    });
  }
  const accepted = suggestions.filter((s) => acceptedBulletIds.includes(s.id));

  // The saved profile's contact details and skills go into the tailored resume.
  const resume = withProfile(toResume(resumeRow), await getProfileValues(user.id));
  const merged = mergeAcceptedBullets(resume, accepted, analysis.matchedKeywords as unknown as string[]);
  if (merged.stale.length) {
    return apiError(409, "RESUME_CHANGED", "Your resume was edited after this analysis. Run the analysis again.");
  }

  const tailoredRow = await prisma.tailoredResume.create({
    data: {
      userId: user.id,
      sourceResumeId: resume.id,
      gapAnalysisId: analysis.id,
      acceptedBulletIds,
      contact: { ...resume.contact },
      summary: resume.summary ?? null,
      workExperience: merged.workExperience as object[],
      education: resume.education as object[],
      skills: merged.skills,
    },
  });
  const tailored: TailoredResume = toTailoredResume(tailoredRow);

  try {
    const fileRows = [];
    const rendered = new Map<Format, Buffer>();
    for (const format of formats as Format[]) {
      const bytes = await FORMATS[format].render(tailored);
      rendered.set(format, bytes);
      fileRows.push({
        userId: user.id,
        tailoredResumeId: tailored.id,
        format,
        fileName: resumeFileName(resume.contact.fullName, format),
        storedFileName: `${randomUUID()}.${format}`,
        mimeType: FORMATS[format].mimeType,
        fileSize: bytes.length,
        data: new Uint8Array(bytes),
      });
    }

    // Score the file the user will download, read back the same way an upload is, so the number
    // matches what re-uploading it would see. Keywords are the analysis's full list for this job.
    const scoredFormat: Format = rendered.has("pdf") ? "pdf" : "docx";
    const finalText = await extractResumeText(rendered.get(scoredFormat)!, scoredFormat);
    const keywords = [
      ...(analysis.matchedKeywords as unknown as string[]),
      ...(analysis.missingKeywords as unknown as string[]),
    ];
    const finalMatchPercent = scoreText(keywords, finalText).matchPercent;

    // Saved on the row so the dashboard can show it later; a failure here is cleaned up below.
    const savedRow = await prisma.tailoredResume.update({ where: { id: tailored.id }, data: { finalMatchPercent } });
    const files = await prisma.$transaction(fileRows.map((data) => prisma.generatedFile.create({ data })));
    return NextResponse.json<TailoredResumeResponse>(
      {
        tailoredResume: toTailoredResume(savedRow),
        files: files.map((f) => toGeneratedFile(f, resume.id)),
        finalMatchPercent,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("tailored resume generation failed", error);
    await prisma.tailoredResume.delete({ where: { id: tailored.id } }).catch(() => undefined);
    return apiError(500, "GENERATION_FAILED", "We couldn't create your resume files. Please try again.");
  }
}
