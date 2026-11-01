// Placeholder learning content for the Learning page, generated per skill until real courses
// exist. Links are searches on well-known sites, never made-up course pages, and the page labels
// the content as suggested. Roadmap step ids are stable so ticked steps survive a reload.

export interface RoadmapStep {
  id: string;
  title: string;
  detail: string;
}

export interface LearningCard {
  title: string;
  meta: string; // e.g. "45 min · Beginner"
  href: string;
  source: string; // where the link goes, e.g. "YouTube"
}

export interface LearningContent {
  roadmap: RoadmapStep[];
  lessons: LearningCard[];
  certifications: LearningCard[];
  practice: LearningCard[];
  challenges: LearningCard[];
  presentations: LearningCard[];
}

const q = (text: string) => encodeURIComponent(text);
const slug = (skill: string) => skill.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "skill";

// Real certifications for common skills; others get a search for one.
const CERTIFICATIONS: Record<string, string[]> = {
  AWS: ["AWS Certified Cloud Practitioner", "AWS Certified Solutions Architect – Associate"],
  Azure: ["Microsoft Azure Fundamentals (AZ-900)", "Microsoft Azure Administrator (AZ-104)"],
  "Google Cloud": ["Google Cloud Associate Cloud Engineer", "Google Cloud Professional Cloud Architect"],
  Kubernetes: ["Certified Kubernetes Application Developer (CKAD)", "Certified Kubernetes Administrator (CKA)"],
  Terraform: ["HashiCorp Certified: Terraform Associate"],
  Python: ["PCEP – Certified Entry-Level Python Programmer", "PCAP – Certified Associate Python Programmer"],
  Java: ["Oracle Certified Professional: Java SE Developer"],
  Databricks: ["Databricks Certified Data Engineer Associate"],
  Snowflake: ["SnowPro Core Certification"],
  "Power BI": ["Microsoft Power BI Data Analyst (PL-300)"],
  Tableau: ["Tableau Certified Data Analyst"],
  "Machine Learning": ["AWS Certified Machine Learning – Specialty", "Google Cloud Professional Machine Learning Engineer"],
  Security: ["CompTIA Security+"],
  Agile: ["Professional Scrum Master I (PSM I)"],
  Kafka: ["Confluent Certified Developer for Apache Kafka"],
  MongoDB: ["MongoDB Associate Developer"],
  Linux: ["Linux Foundation Certified System Administrator (LFCS)"],
  "C#": ["Microsoft Azure Developer Associate (AZ-204)"],
};

export function learningContent(skill: string): LearningContent {
  const id = slug(skill);
  const certNames = CERTIFICATIONS[skill] ?? [`${skill} certification`];
  return {
    roadmap: [
      { id: `${id}-1`, title: `${skill} fundamentals`, detail: `Learn the core ideas and vocabulary of ${skill} and set up a working environment.` },
      { id: `${id}-2`, title: "Core concepts in practice", detail: `Work through the features you'll use daily, with small exercises after each topic.` },
      { id: `${id}-3`, title: "Build a guided project", detail: `Follow a project end to end so you see how ${skill} fits into a real application.` },
      { id: `${id}-4`, title: "Build your own project", detail: `Make something of your own with ${skill} and put it on GitHub with a short README.` },
      { id: `${id}-5`, title: "Production practices", detail: "Testing, performance, security and the tooling teams use around it." },
      { id: `${id}-6`, title: "Interview-ready", detail: `Practice explaining your ${skill} work and answering common interview questions.` },
    ],
    lessons: [
      { title: `${skill} crash course`, meta: "1–2 hrs · Beginner", source: "YouTube", href: `https://www.youtube.com/results?search_query=${q(`${skill} crash course`)}` },
      { title: `${skill} for beginners: full course`, meta: "Self-paced · Beginner", source: "Coursera", href: `https://www.coursera.org/search?query=${q(skill)}` },
      { title: `Hands-on ${skill} tutorials`, meta: "Articles · Beginner–Intermediate", source: "freeCodeCamp", href: `https://www.freecodecamp.org/news/search/?query=${q(skill)}` },
      { title: `Advanced ${skill}`, meta: "Self-paced · Advanced", source: "edX", href: `https://www.edx.org/search?q=${q(skill)}` },
    ],
    certifications: certNames.map((name) => ({
      title: name,
      meta: "Exam · Industry-recognized",
      source: "Search",
      href: `https://www.google.com/search?q=${q(`${name} exam guide`)}`,
    })),
    practice: [
      { title: `${skill} exercises`, meta: "Repositories · Short exercises", source: "GitHub", href: `https://github.com/search?q=${q(`${skill} exercises`)}&type=repositories` },
      { title: `${skill} starter projects`, meta: "Repositories · Project ideas", source: "GitHub", href: `https://github.com/search?q=${q(`${skill} project ideas`)}&type=repositories` },
      { title: `Interactive ${skill} practice`, meta: "Browser-based · Beginner", source: "Search", href: `https://www.google.com/search?q=${q(`interactive ${skill} practice online`)}` },
    ],
    challenges: [
      { title: "Algorithm problems", meta: "Easy → Hard · Timed", source: "LeetCode", href: "https://leetcode.com/problemset/" },
      { title: `${skill} skill challenges`, meta: "Ranked · Certificates of completion", source: "HackerRank", href: "https://www.hackerrank.com/dashboard" },
      { title: `${skill} take-home style tasks`, meta: "Realistic · 2–4 hrs", source: "GitHub", href: `https://github.com/search?q=${q(`${skill} take home assignment`)}&type=repositories` },
    ],
    presentations: [
      { title: `Conference talks on ${skill}`, meta: "Videos · 20–45 min", source: "YouTube", href: `https://www.youtube.com/results?search_query=${q(`${skill} conference talk`)}` },
      { title: `${skill} slide decks`, meta: "Slides · Browse", source: "Speaker Deck", href: `https://speakerdeck.com/search?q=${q(skill)}` },
      { title: `Present what you built with ${skill}`, meta: "Your turn · 5 min demo", source: "Tip", href: `https://www.google.com/search?q=${q("how to give a short technical demo")}` },
    ],
  };
}

/** The roadmap step ids for a skill, for validating ticked steps. */
export const roadmapStepIds = (skill: string) => learningContent(skill).roadmap.map((s) => s.id);
