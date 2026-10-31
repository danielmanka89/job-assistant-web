// Skill and keyword helpers shared by the API and the frontend (no server-only imports).

const key = (term: string) => term.trim().toLowerCase();

/** Appends newSkills to skills, skipping blanks and case-insensitive duplicates. Keeps existing order. */
export function mergeSkills(skills: string[], newSkills: string[]): string[] {
  const seen = new Set(skills.map(key));
  const out = [...skills];
  for (const skill of newSkills.map((s) => s.trim()).filter(Boolean)) {
    if (!seen.has(key(skill))) {
      seen.add(key(skill));
      out.push(skill);
    }
  }
  return out;
}

/** Share of the job's keywords the resume covers, as a whole percentage (0 when there are none). */
export function matchPercent(matched: number, missing: number): number {
  const total = matched + missing;
  return total === 0 ? 0 : Math.round((matched / total) * 100);
}

export interface KeywordMatch {
  matchedKeywords: string[];
  missingKeywords: string[];
  matchPercent: number;
}

/**
 * Moves missing keywords that appear in skills (case-insensitive) to matched.
 * Used after adding skills to a resume, and to preview the score for a selection before saving.
 */
export function withAddedSkills(
  analysis: { matchedKeywords: string[]; missingKeywords: string[] },
  skills: string[],
): KeywordMatch {
  const covered = new Set(skills.map(key));
  const nowMatched = analysis.missingKeywords.filter((k) => covered.has(key(k)));
  const matchedKeywords = [...analysis.matchedKeywords, ...nowMatched];
  const missingKeywords = analysis.missingKeywords.filter((k) => !covered.has(key(k)));
  return { matchedKeywords, missingKeywords, matchPercent: matchPercent(matchedKeywords.length, missingKeywords.length) };
}
