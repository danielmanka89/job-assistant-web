// Market Reach: how much of the skill demand in open jobs the candidate's resume covers, and which
// missing skills would raise it most. Shared by the API and mock mode (no server-only imports).
//
// Demand for a skill = the open jobs on the Job Board that mention it, plus a small baseline from
// the catalog below, so the score stays meaningful when there are only a few postings.
// Reach = covered demand / total demand, over the TOP_SKILLS most in-demand skills.

import type { MissingSkill } from "@/lib/types";
import { scoreText } from "@/lib/skills";

interface CatalogSkill {
  name: string; // shown to the user
  aliases: string[]; // matched as whole terms, ignoring case and punctuation ("Node.js" = "node js")
  baseline: number; // general demand, 1-10, used when there are few postings
}

// Short or everyday words ("Go", "R", "C", "REST") are left out: they'd match ordinary text in job ads.
export const SKILL_CATALOG: readonly CatalogSkill[] = [
  { name: "Python", aliases: ["Python"], baseline: 10 },
  { name: "SQL", aliases: ["SQL"], baseline: 10 },
  { name: "JavaScript", aliases: ["JavaScript", "ES6"], baseline: 9 },
  { name: "TypeScript", aliases: ["TypeScript"], baseline: 8 },
  { name: "Java", aliases: ["Java"], baseline: 8 },
  { name: "C#", aliases: ["C#", ".NET", "dotnet"], baseline: 6 },
  { name: "C++", aliases: ["C++"], baseline: 5 },
  { name: "Golang", aliases: ["Golang"], baseline: 4 },
  { name: "Rust", aliases: ["Rust"], baseline: 3 },
  { name: "React", aliases: ["React", "React.js", "ReactJS"], baseline: 9 },
  { name: "Next.js", aliases: ["Next.js", "NextJS"], baseline: 5 },
  { name: "Angular", aliases: ["Angular"], baseline: 5 },
  { name: "Vue", aliases: ["Vue", "Vue.js"], baseline: 4 },
  { name: "Node.js", aliases: ["Node.js", "NodeJS", "Node"], baseline: 8 },
  { name: "GraphQL", aliases: ["GraphQL"], baseline: 4 },
  { name: "REST APIs", aliases: ["RESTful", "REST API", "REST APIs"], baseline: 7 },
  { name: "AWS", aliases: ["AWS", "Amazon Web Services"], baseline: 10 },
  { name: "Azure", aliases: ["Azure"], baseline: 7 },
  { name: "Google Cloud", aliases: ["GCP", "Google Cloud", "Google Cloud Platform"], baseline: 6 },
  { name: "Docker", aliases: ["Docker"], baseline: 8 },
  { name: "Kubernetes", aliases: ["Kubernetes", "K8s"], baseline: 8 },
  { name: "Terraform", aliases: ["Terraform"], baseline: 6 },
  { name: "CI/CD", aliases: ["CI/CD", "CI CD", "GitHub Actions", "Jenkins", "GitLab CI"], baseline: 7 },
  { name: "Linux", aliases: ["Linux"], baseline: 6 },
  { name: "Git", aliases: ["Git"], baseline: 6 },
  { name: "PostgreSQL", aliases: ["PostgreSQL", "Postgres"], baseline: 6 },
  { name: "MongoDB", aliases: ["MongoDB"], baseline: 4 },
  { name: "Redis", aliases: ["Redis"], baseline: 4 },
  { name: "Kafka", aliases: ["Kafka"], baseline: 5 },
  { name: "Spark", aliases: ["Apache Spark", "PySpark", "Spark SQL"], baseline: 6 },
  { name: "Snowflake", aliases: ["Snowflake"], baseline: 5 },
  { name: "Databricks", aliases: ["Databricks"], baseline: 5 },
  { name: "Airflow", aliases: ["Airflow"], baseline: 4 },
  { name: "dbt", aliases: ["dbt"], baseline: 4 },
  { name: "Tableau", aliases: ["Tableau"], baseline: 4 },
  { name: "Power BI", aliases: ["Power BI", "PowerBI"], baseline: 5 },
  { name: "Machine Learning", aliases: ["Machine Learning", "ML"], baseline: 8 },
  { name: "Deep Learning", aliases: ["Deep Learning"], baseline: 5 },
  { name: "PyTorch", aliases: ["PyTorch"], baseline: 6 },
  { name: "TensorFlow", aliases: ["TensorFlow"], baseline: 5 },
  { name: "LLMs", aliases: ["LLM", "LLMs", "Large Language Models", "GenAI", "Generative AI"], baseline: 8 },
  { name: "RAG", aliases: ["RAG", "Retrieval-Augmented Generation", "Retrieval Augmented Generation"], baseline: 5 },
  { name: "MLOps", aliases: ["MLOps", "MLflow", "Kubeflow"], baseline: 5 },
  { name: "NLP", aliases: ["NLP", "Natural Language Processing"], baseline: 5 },
  { name: "Computer Vision", aliases: ["Computer Vision", "OpenCV"], baseline: 4 },
  { name: "Data Analysis", aliases: ["Pandas", "NumPy", "Data Analysis"], baseline: 6 },
  { name: "Statistics", aliases: ["Statistics", "A/B testing", "Hypothesis testing"], baseline: 5 },
  { name: "Microservices", aliases: ["Microservices", "Microservice"], baseline: 6 },
  { name: "System Design", aliases: ["System Design", "Distributed Systems"], baseline: 6 },
  { name: "Testing", aliases: ["Unit testing", "Jest", "Cypress", "Playwright", "Pytest", "Testing Library"], baseline: 6 },
  { name: "Tailwind CSS", aliases: ["Tailwind", "Tailwind CSS"], baseline: 4 },
  { name: "Accessibility", aliases: ["Accessibility", "WCAG", "a11y"], baseline: 4 },
  { name: "Figma", aliases: ["Figma"], baseline: 3 },
  { name: "Agile", aliases: ["Agile", "Scrum", "Kanban"], baseline: 5 },
  { name: "Security", aliases: ["OAuth", "OWASP", "Application Security", "IAM"], baseline: 5 },
];

const TOP_SKILLS = 25; // reach is measured over the most in-demand skills
const MAX_MISSING = 5;

export interface MarketReach {
  percent: number; // 0-100
  jobsAnalyzed: number; // open jobs that mention at least one catalog skill
  missingSkills: MissingSkill[]; // most valuable first
}

const mentions = (skill: CatalogSkill, text: string) => scoreText(skill.aliases, text).matchedKeywords.length > 0;

/**
 * Computes Market Reach from the candidate's declared skills and certifications (their resume)
 * and the descriptions of open jobs.
 */
export function marketReach(candidate: { skills: string[]; certifications?: string[] }, jobDescriptions: string[]): MarketReach {
  const candidateText = [...candidate.skills, ...(candidate.certifications ?? [])].join(", ");
  const jobs = jobDescriptions.map((d) => SKILL_CATALOG.filter((s) => mentions(s, d)));
  const jobsAnalyzed = jobs.filter((skills) => skills.length > 0).length;

  const ranked = SKILL_CATALOG.map((skill) => {
    const jobCount = jobs.filter((skills) => skills.includes(skill)).length;
    return { skill, jobCount, demand: jobCount + skill.baseline / 10 };
  })
    .sort((a, b) => b.demand - a.demand || b.skill.baseline - a.skill.baseline)
    .slice(0, TOP_SKILLS);

  const total = ranked.reduce((sum, r) => sum + r.demand, 0);
  const has = (r: (typeof ranked)[number]) => mentions(r.skill, candidateText);
  const covered = ranked.filter(has).reduce((sum, r) => sum + r.demand, 0);

  const missingSkills = ranked
    .filter((r) => !has(r))
    .slice(0, MAX_MISSING)
    .map((r) => ({ skill: r.skill.name, jobCount: r.jobCount, gainPercent: Math.max(1, Math.round((r.demand / total) * 100)) }));

  return { percent: total ? Math.round((covered / total) * 100) : 0, jobsAnalyzed, missingSkills };
}
