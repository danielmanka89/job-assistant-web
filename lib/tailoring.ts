// Making a tailored resume (server side), shared by the job match (POST /api/gap-analysis + POST /api/tailor)
// and My JDs (POST /api/jds/:id/tailor), so both produce the same files and score.

import { randomUUID } from "node:crypto";
import { analyzeGap } from "@/lib/ai";
import { toGeneratedFile, toResume, toTailoredResume } from "@/lib/api";
import { prisma } from "@/lib/db";
import type { GapAnalysis as GapAnalysisRow } from "@/lib/generated/prisma/client";
import { withProfile } from "@/lib/profile";
import { getProfileValues } from "@/lib/profile-store";
import { renderDocx, renderPdf, resumeFileName } from "@/lib/resume-files";
import { extractResumeText } from "@/lib/resume-text";
import { scoreText } from "@/lib/skills";
import { mergeAcceptedBullets } from "@/lib/tailor";
import type { Resume, SuggestedBullet, TailoredResume, TailoredResumeResponse } from "@/lib/types";

/** A stored resume as queries return it (the file bytes are left out). */
type ResumeRow = Parameters<typeof toResume>[0];

export const FORMATS = {
  docx: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", render: renderDocx },
  pdf: { mimeType: "application/pdf", render: renderPdf },
} as const;
export type Format = keyof typeof FORMATS;

/** The resume as tailoring sees it: the stored resume with the saved profile's contact details and skills. */
export async function resumeWithProfile(userId: string, row: ResumeRow): Promise<Resume> {
  return withProfile(toResume(row), await getProfileValues(userId));
}

/** Runs the AI comparison and stores it. Throws AiError when the AI call fails. */
export async function createGapAnalysis(userId: string, row: ResumeRow, jobDescription: string): Promise<GapAnalysisRow> {
  const result = await analyzeGap(await resumeWithProfile(userId, row), jobDescription);
  return prisma.gapAnalysis.create({
    data: {
      userId,
      resumeId: row.id,
      jobDescription,
      matchedKeywords: result.matchedKeywords,
      missingKeywords: result.missingKeywords,
      suggestedBullets: result.suggestedBullets as object[],
    },
  });
}

export class ResumeChangedError extends Error {}

/**
 * Merges the accepted suggestions into the resume, stores the TailoredResume, renders the files and
 * scores the final file. Throws ResumeChangedError if the resume was edited after the analysis; on a
 * rendering failure the half-made TailoredResume is removed and the error is rethrown.
 */
export async function createTailoredResume(
  userId: string,
  resumeRow: ResumeRow,
  analysis: GapAnalysisRow,
  acceptedBulletIds: string[],
  formats: Format[],
): Promise<TailoredResumeResponse> {
  const suggestions = analysis.suggestedBullets as unknown as SuggestedBullet[];
  const accepted = suggestions.filter((s) => acceptedBulletIds.includes(s.id));

  const resume = await resumeWithProfile(userId, resumeRow);
  const merged = mergeAcceptedBullets(resume, accepted, analysis.matchedKeywords as unknown as string[]);
  if (merged.stale.length) throw new ResumeChangedError("resume edited after the analysis");

  const tailoredRow = await prisma.tailoredResume.create({
    data: {
      userId,
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
    for (const format of formats) {
      const bytes = await FORMATS[format].render(tailored);
      rendered.set(format, bytes);
      fileRows.push({
        userId,
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

    const savedRow = await prisma.tailoredResume.update({ where: { id: tailored.id }, data: { finalMatchPercent } });
    const files = await prisma.$transaction(fileRows.map((data) => prisma.generatedFile.create({ data })));
    return {
      tailoredResume: toTailoredResume(savedRow),
      files: files.map((f) => toGeneratedFile(f, resume.id)),
      finalMatchPercent,
    };
  } catch (error) {
    await prisma.tailoredResume.delete({ where: { id: tailored.id } }).catch(() => undefined);
    throw error;
  }
}
