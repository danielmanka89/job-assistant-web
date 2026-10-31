import type { Resume, SuggestedBullet, WorkExperience } from "@/lib/types";

export interface MergeResult {
  workExperience: WorkExperience[];
  skills: string[];
  /** Accepted suggestions whose original bullet is no longer on the resume (edited after the analysis). */
  stale: SuggestedBullet[];
}

/**
 * Applies only the accepted suggestions to the resume. Each one replaces the bullet it was written
 * for (same job, same original text); nothing else in the experience changes. Skills are reordered
 * so ones the job asks for come first; none are added or removed.
 */
export function mergeAcceptedBullets(
  resume: Resume,
  accepted: SuggestedBullet[],
  matchedKeywords: string[],
): MergeResult {
  const stale: SuggestedBullet[] = [];
  const workExperience = resume.workExperience.map((w) => ({ ...w, bullets: w.bullets.map((b) => ({ ...b })) }));

  for (const suggestion of accepted) {
    const job = workExperience.find((w) => w.id === suggestion.workExperienceId);
    const bullet = job?.bullets.find((b) => b.text.trim() === suggestion.originalText.trim());
    if (bullet) bullet.text = suggestion.text;
    else stale.push(suggestion);
  }

  const matched = new Set(matchedKeywords.map((k) => k.toLowerCase()));
  const isMatched = (skill: string) => matched.has(skill.toLowerCase());
  const skills = [...resume.skills.filter(isMatched), ...resume.skills.filter((s) => !isMatched(s))];

  return { workExperience, skills, stale };
}
