// Local stand-ins for the backend so the UI can be built before the API exists.
// Enabled with NEXT_PUBLIC_MOCK_API=true. Handy test inputs:
//   register with taken@example.com  -> "email already registered" field error
//   login with password "wrongpass"  -> invalid credentials error
//   upload a file with "fail" in its name -> parse error
//   gap analysis with "fail" in the job description -> analysis error
//   summary generation with "summary-fail" in the job description -> generation error
//   tailoring with "tailor-fail" in the job description -> generation error
//   posting a job titled with "fail" in it -> server error
//   log in with an email containing "employer" -> employer account
//   log in with an email containing "new" -> dashboard with no tailored resumes yet
//   settings: current password "wrongpass" -> incorrect password; email taken@example.com -> already registered
//   resume sync: compares the sample resume with the profile; "changed" in the file name -> a resume
//     with a new phone, location and skill (red alert); "fail" in the file name -> parse error
//   learning: Market Reach of the sample resume against the sample jobs; paths kept in memory
//   profile: read-only, created from the sample resume (empty for "new" users)
//   spreadsheet: starts with two sample rows (none for "new" users); a cell containing "fail" -> save error
import type {
  AccountResponse,
  ApiError,
  AuthResponse,
  CreateJobPostingRequest,
  CreateSubmissionRequest,
  CreateSubmissionResponse,
  DashboardStats,
  GapAnalysisRequest,
  GapAnalysisResponse,
  LoginRequest,
  ProfileResponse,
  ProfileValues,
  RandomQuoteResponse,
  RegisterRequest,
  GeneratedFile,
  JobPosting,
  LearningInsights,
  LearningPath,
  Resume,
  ResumeCompareResponse,
  ResumeSyncResponse,
  Submission,
  SummaryGenerateRequest,
  SummaryGenerateResponse,
  TailoredResume,
  TailoredResumeRequest,
  TailoredResumeResponse,
  TailoredResumeWithFiles,
  UpdateAccountRequest,
  UpdateLearningPathRequest,
  UpdateSubmissionRequest,
  User,
  UserRole,
} from "@/lib/types";
import { quoteSlot } from "@/lib/quote-rotation";
import { matchPercent, mergeSkills, scoreText } from "@/lib/skills";
import { roadmapStepIds } from "@/lib/learning-content";
import { marketReach } from "@/lib/market-reach";
import { isEmptyProfile, profileFromResume, syncProfileToResume } from "@/lib/profile";
import { SHEETS, buildSubmissionWorkbook, prefillSubmission, validateSheetValues } from "@/lib/spreadsheet";
import { XLSX_MIME } from "@/lib/xlsx";
import type { ApiResult } from "./api";
import { readStoredUser } from "./current-user";
import { SESSION_COOKIE } from "./session";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fail(error: ApiError): { ok: false; error: ApiError } {
  return { ok: false, error };
}

// The real backend sets an HTTP-only cookie. In mock mode we set a plain one
// so proxy.ts lets the user through to /dashboard.
function setMockSession() {
  document.cookie = `${SESSION_COOKIE}=mock; path=/; samesite=lax`;
}

function clearMockSession() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

function mockUser(email: string, name: string, role: UserRole = "SEEKER"): User {
  return {
    id: "user_mock_1",
    email,
    name,
    role,
    clockTemplate: "MINIMALIST",
    createdAt: new Date().toISOString(),
  };
}

async function register(payload: RegisterRequest): Promise<ApiResult<AuthResponse>> {
  await delay(700);
  if (payload.email.toLowerCase() === "taken@example.com") {
    return fail({
      code: "EMAIL_TAKEN",
      message: "Please fix the highlighted fields.",
      fieldErrors: { email: "An account with this email already exists." },
    });
  }
  setMockSession();
  return { ok: true, data: { user: mockUser(payload.email, payload.name, payload.role ?? "SEEKER") } };
}

async function login(payload: LoginRequest): Promise<ApiResult<AuthResponse>> {
  await delay(600);
  if (payload.password === "wrongpass") {
    return fail({
      code: "INVALID_CREDENTIALS",
      message: "That email and password combination doesn't match our records.",
    });
  }
  setMockSession();
  const role: UserRole = payload.email.toLowerCase().includes("employer") ? "EMPLOYER" : "SEEKER";
  return { ok: true, data: { user: mockUser(payload.email, "Jane Doe", role) } };
}

async function logout(): Promise<void> {
  await delay(150);
  clearMockSession();
}

async function getAccount(): Promise<ApiResult<AccountResponse>> {
  await delay(300);
  return { ok: true, data: { user: readStoredUser() ?? mockUser("jane@example.com", "Jane Doe") } };
}

async function updateAccount(request: UpdateAccountRequest): Promise<ApiResult<AccountResponse>> {
  await delay(600);
  if ((request.email !== undefined || request.newPassword !== undefined) && request.currentPassword === "wrongpass") {
    return fail({
      code: "INVALID_PASSWORD",
      message: "Your current password is incorrect",
      fieldErrors: { currentPassword: "Current password is incorrect" },
    });
  }
  if (request.email?.trim().toLowerCase() === "taken@example.com") {
    return fail({
      code: "EMAIL_TAKEN",
      message: "An account with this email already exists",
      fieldErrors: { email: "Already registered" },
    });
  }
  const user = readStoredUser() ?? mockUser("jane@example.com", "Jane Doe");
  return {
    ok: true,
    data: {
      user: {
        ...user,
        ...(request.name !== undefined ? { name: request.name.trim() } : {}),
        ...(request.email !== undefined ? { email: request.email.trim().toLowerCase() } : {}),
        ...(request.clockTemplate !== undefined ? { clockTemplate: request.clockTemplate } : {}),
      },
    },
  };
}

async function uploadResume(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ApiResult<Resume>> {
  for (let p = 0; p <= 100; p += 10) {
    onProgress?.(p);
    await delay(90);
  }
  // Stands in for the AI parsing time after the file has been sent.
  await delay(3500);

  if (file.name.toLowerCase().includes("fail")) {
    return fail({
      code: "PARSE_FAILED",
      message: "We couldn't read this resume. Try exporting it again as PDF or DOCX.",
    });
  }

  const resume = sampleResume(file.name);
  if (file.name.toLowerCase().includes("changed")) {
    resume.contact = { ...resume.contact, phone: "+1 (301) 555-9876", location: "Frisco, TX" };
    resume.skills = [...resume.skills, "AWS"];
  }
  return { ok: true, data: resume };
}

export function sampleResume(fileName = "Jane_Doe_CV.pdf"): Resume {
  const now = new Date().toISOString();
  return {
    id: "resume_mock_1",
    userId: "user_mock_1",
    sourceFileName: fileName,
    contact: {
      fullName: "Jane Doe",
      email: "jane.doe@example.com",
      location: "Berlin, Germany",
      linkedinUrl: "https://linkedin.com/in/janedoe",
      workAuthorization: "EU Blue Card",
      desiredPay: "€75,000/yr",
    },
    summary: "Frontend engineer with 5 years of experience building React apps.",
    workExperience: [
      {
        id: "we_1",
        jobTitle: "Frontend Engineer",
        company: "Acme GmbH",
        startDate: "2022-03",
        endDate: null,
        bullets: [
          { id: "b_1", text: "Rebuilt the checkout flow in React, cutting drop-off by 18%." },
          { id: "b_2", text: "Introduced a shared component library used by 4 teams." },
        ],
      },
      {
        id: "we_2",
        jobTitle: "Web Developer",
        company: "Northwind",
        startDate: "2019-01",
        endDate: "2022-02",
        bullets: [{ id: "b_3", text: "Maintained the marketing site and CMS integrations." }],
      },
    ],
    education: [
      {
        id: "ed_1",
        institution: "TU Berlin",
        degree: "B.Sc.",
        fieldOfStudy: "Computer Science",
        startDate: "2015-10",
        endDate: "2018-09",
      },
    ],
    skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Testing Library", "Figma"],
    certifications: ["AWS Certified Developer – Associate", "Google UX Design Certificate"],
    createdAt: now,
    updatedAt: now,
  };
}

// Skills added with addSkills in this tab, so a re-run of analyzeGap shows the higher score.
let mockAddedSkills: string[] = [];

async function addSkills(resumeId: string, newSkills: string[]): Promise<ApiResult<Resume>> {
  await delay(500);
  if (!newSkills.some((s) => s.trim())) {
    return fail({ code: "VALIDATION_ERROR", message: "Please fix the highlighted fields", fieldErrors: { newSkills: "Pick at least one skill to add" } });
  }
  mockAddedSkills = mergeSkills(mockAddedSkills, newSkills);
  const resume = sampleResume();
  return {
    ok: true,
    data: { ...resume, id: resumeId, skills: mergeSkills(resume.skills, mockAddedSkills), updatedAt: new Date().toISOString() },
  };
}

async function generateSummaries(request: SummaryGenerateRequest): Promise<ApiResult<SummaryGenerateResponse>> {
  await delay(1200);
  if (request.jobDescription.toLowerCase().includes("summary-fail")) {
    return fail({ code: "SUMMARY_FAILED", message: "We couldn't write summary options for this job. Please try again." });
  }
  return {
    ok: true,
    data: {
      options: [
        "Frontend engineer who takes ownership of work that spans teams. Rebuilt the React checkout flow, cutting drop-off by 18%, and introduced a shared component library now used by 4 teams.",
        "Frontend engineer working mainly in React and TypeScript, with a focus on component architecture and performance. Built a shared component library used by 4 teams and rebuilt a checkout flow that cut drop-off by 18%.",
        "Frontend engineer focused on e-commerce, building checkout and storefront experiences that customers rely on. Rebuilt a React checkout flow that cut drop-off by 18% and keeps marketing sites and CMS integrations stable.",
      ],
    },
  };
}

async function saveSummary(resumeId: string, newSummary: string): Promise<ApiResult<Resume>> {
  await delay(500);
  if (!newSummary.trim()) {
    return fail({ code: "VALIDATION_ERROR", message: "Please fix the highlighted fields", fieldErrors: { newSummary: "Required" } });
  }
  return {
    ok: true,
    data: { ...sampleResume(), id: resumeId, summary: newSummary.trim(), updatedAt: new Date().toISOString() },
  };
}

async function saveResume(resume: Resume): Promise<ApiResult<Resume>> {
  console.log("Resume to save (mock):", JSON.stringify(resume, null, 2));
  await delay(600);
  return { ok: true, data: { ...resume, updatedAt: new Date().toISOString() } };
}

// Terms the mock looks for in a job description. The real endpoint uses the AI model instead.
const KNOWN_KEYWORDS = [
  "React", "TypeScript", "JavaScript", "Next.js", "Node.js", "GraphQL", "REST", "Tailwind CSS",
  "CSS", "HTML", "Accessibility", "Testing Library", "Jest", "Playwright", "Cypress", "Storybook",
  "Design systems", "Figma", "Performance", "CI/CD", "AWS", "Docker", "Kubernetes", "Python",
  "SQL", "PostgreSQL", "Agile", "Mentoring", "A/B testing", "Analytics", "Redux", "Vue", "Angular",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentions(text: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword.toLowerCase())}($|[^a-z0-9])`).test(text);
}

async function analyzeGap(request: GapAnalysisRequest): Promise<ApiResult<GapAnalysisResponse>> {
  await delay(1400);
  const jd = request.jobDescription.toLowerCase();
  if (jd.includes("fail")) {
    return fail({
      code: "ANALYSIS_FAILED",
      message: "We couldn't analyze this job description right now. Please try again.",
    });
  }

  const resume = sampleResume();
  const resumeText = [
    resume.summary ?? "",
    ...mergeSkills(resume.skills, mockAddedSkills),
    ...resume.workExperience.flatMap((w) => [w.jobTitle, ...w.bullets.map((b) => b.text)]),
  ]
    .join(" ")
    .toLowerCase();

  const inJob = KNOWN_KEYWORDS.filter((k) => mentions(jd, k));
  const matchedKeywords = inJob.filter((k) => mentions(resumeText, k));
  const missingKeywords = inJob.filter((k) => !mentions(resumeText, k));
  const focus = missingKeywords[0] ?? matchedKeywords[0] ?? "the role";

  return {
    ok: true,
    data: {
      id: "gap_mock_1",
      matchedKeywords,
      missingKeywords,
      matchPercent: matchPercent(matchedKeywords.length, missingKeywords.length),
      suggestedBullets: [
        {
          id: "sb_1",
          workExperienceId: "we_1",
          originalText: "Rebuilt the checkout flow in React, cutting drop-off by 18%.",
          text: "Led the rebuild of the React checkout flow, cutting drop-off by 18% and improving conversion.",
          reason: "Puts the measurable result first and shows ownership, which the posting asks for.",
        },
        {
          id: "sb_2",
          workExperienceId: "we_1",
          originalText: "Introduced a shared component library used by 4 teams.",
          text: "Built and rolled out a shared component library (design system) adopted by 4 product teams.",
          reason: `Uses the posting's wording around design systems and cross-team work, close to "${focus}".`,
        },
        {
          id: "sb_3",
          workExperienceId: "we_2",
          originalText: "Maintained the marketing site and CMS integrations.",
          text: "Maintained the company marketing site and its CMS integrations, keeping releases stable.",
          reason: "Highlights reliability, a theme that comes up several times in the job description.",
        },
      ],
    },
  };
}

// Mirrors the bullets returned by analyzeGap so accepted ids can be merged in.
const MOCK_SUGGESTIONS: Record<string, { originalText: string; text: string }> = {
  sb_1: {
    originalText: "Rebuilt the checkout flow in React, cutting drop-off by 18%.",
    text: "Led the rebuild of the React checkout flow, cutting drop-off by 18% and improving conversion.",
  },
  sb_2: {
    originalText: "Introduced a shared component library used by 4 teams.",
    text: "Built and rolled out a shared component library (design system) adopted by 4 product teams.",
  },
  sb_3: {
    originalText: "Maintained the marketing site and CMS integrations.",
    text: "Maintained the company marketing site and its CMS integrations, keeping releases stable.",
  },
};

function plainTextResume(resume: TailoredResume): string {
  const lines = [resume.contact.fullName, resume.contact.email, ""];
  if (resume.summary) lines.push(resume.summary, "");
  for (const job of resume.workExperience) {
    lines.push(`${job.jobTitle}, ${job.company}`);
    for (const bullet of job.bullets) lines.push(`- ${bullet.text}`);
    lines.push("");
  }
  lines.push(`Skills: ${resume.skills.join(", ")}`);
  return lines.join("\n");
}

async function tailorResume(request: TailoredResumeRequest): Promise<ApiResult<TailoredResumeResponse>> {
  await delay(2800);
  if (request.jobDescription.toLowerCase().includes("tailor-fail")) {
    return fail({
      code: "GENERATION_FAILED",
      message: "We couldn't generate your files. Please try again.",
    });
  }

  const base = sampleResume();
  const accepted = request.acceptedBulletIds
    .map((id) => MOCK_SUGGESTIONS[id])
    .filter((s): s is { originalText: string; text: string } => Boolean(s));
  const now = new Date().toISOString();

  const tailoredResume: TailoredResume = {
    id: "tailored_mock_1",
    userId: base.userId,
    sourceResumeId: request.resumeId,
    gapAnalysisId: request.gapAnalysisId,
    acceptedBulletIds: request.acceptedBulletIds,
    contact: base.contact,
    summary: base.summary,
    workExperience: base.workExperience.map((job) => ({
      ...job,
      bullets: job.bullets.map((bullet) => {
        const match = accepted.find((s) => s.originalText === bullet.text);
        return match ? { ...bullet, text: match.text } : bullet;
      }),
    })),
    education: base.education,
    skills: base.skills,
    finalMatchPercent: null, // scored from the file text below
    createdAt: now,
  };

  // No real documents in mock mode: each "file" is a plain-text copy so the download buttons can be tried.
  const text = plainTextResume(tailoredResume);
  const files: GeneratedFile[] = request.formats.map((format) => ({
    id: `file_mock_${format}`,
    resumeId: request.resumeId,
    tailoredResumeId: tailoredResume.id,
    format,
    fileName: `Jane_Doe_Resume.mock-${format}.txt`,
    downloadUrl: URL.createObjectURL(new Blob([text], { type: "text/plain" })),
    createdAt: now,
  }));

  const jobKeywords = KNOWN_KEYWORDS.filter((k) => mentions(request.jobDescription.toLowerCase(), k));
  const finalMatchPercent = scoreText(jobKeywords, text).matchPercent;

  return { ok: true, data: { tailoredResume: { ...tailoredResume, finalMatchPercent }, files, finalMatchPercent } };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Sample postings for mock mode. */
export function sampleJobs(): JobPosting[] {
  return [
    {
      id: "job_1",
      applyUrl: "https://example.com/jobs/1",
      title: "Senior Frontend Engineer",
      company: "Lumen Health",
      location: "Berlin, Germany (Hybrid)",
      source: "mock",
      createdAt: daysAgo(1),
      description:
        "Lumen Health is looking for a Senior Frontend Engineer to lead the web experience for our patient app. You will build accessible, fast interfaces in React and TypeScript, work closely with design on our component library, and mentor two mid-level engineers.\n\nWhat you'll do:\n- Own features end to end, from design review to release\n- Improve performance and accessibility across the app\n- Shape our design system with the design team\n\nWhat we're looking for:\n- 5+ years building production React apps\n- Strong TypeScript and testing skills (Jest, Testing Library, Playwright)\n- Experience with Next.js and GraphQL is a plus",
    },
    {
      id: "job_2",
      applyUrl: "https://example.com/jobs/2",
      title: "Full-Stack Developer (Node.js / React)",
      company: "Northwind Logistics",
      location: "Remote (EU)",
      source: "mock",
      createdAt: daysAgo(3),
      description:
        "Join a small product team building the tools our warehouses use every day. You'll work across a React front end and Node.js services backed by PostgreSQL.\n\nResponsibilities:\n- Build and maintain REST APIs in Node.js\n- Ship React features used by 2,000 warehouse staff\n- Set up CI/CD pipelines and monitoring on AWS\n\nRequirements:\n- 3+ years with JavaScript or TypeScript\n- Experience with SQL databases\n- Docker and AWS experience preferred",
    },
    {
      id: "job_3",
      applyUrl: "https://example.com/jobs/3",
      title: "UI Engineer, Design Systems",
      company: "Atlas Bank",
      location: "Munich, Germany",
      source: "mock",
      createdAt: daysAgo(5),
      description:
        "Atlas Bank's design systems team builds the components behind every customer screen. We're hiring a UI Engineer who cares about accessibility and consistency.\n\nYou will:\n- Build and document React components in Storybook\n- Work with designers in Figma to define tokens and patterns\n- Help product teams adopt the design system\n\nYou have:\n- Deep knowledge of HTML, CSS and accessibility (WCAG 2.2)\n- Experience with React and TypeScript\n- Clear written communication",
    },
    {
      id: "job_4",
      applyUrl: "https://example.com/jobs/4",
      title: "Frontend Developer",
      company: "Kite Travel",
      location: "Hamburg, Germany",
      source: "mock",
      createdAt: daysAgo(8),
      description:
        "Kite Travel is growing and needs a Frontend Developer to help rebuild our booking flow. You'll work in Vue today with a gradual move to React.\n\nWhat you'll work on:\n- A faster, simpler checkout\n- A/B testing new booking steps with our analytics team\n- Fixing performance issues on mobile\n\nNice to have: experience with Vue, React, and analytics tools.",
    },
    {
      id: "job_5",
      applyUrl: "https://example.com/jobs/5",
      title: "Software Engineer, Web Platform",
      company: "Orbit Analytics",
      location: "Amsterdam, Netherlands",
      source: "mock",
      createdAt: daysAgo(12),
      description:
        "We're looking for an engineer to improve the platform our web teams build on: build tooling, shared libraries and the Next.js app shell.\n\nYou'll:\n- Speed up builds and CI\n- Maintain shared TypeScript libraries\n- Improve Core Web Vitals across products\n\nYou bring: strong TypeScript, Next.js, and an eye for developer experience. Kubernetes knowledge is a bonus.",
    },
    {
      id: "job_6",
      applyUrl: "https://example.com/jobs/6",
      title: "Junior React Developer",
      company: "Greenleaf Studio",
      location: "Remote (Germany)",
      source: "mock",
      createdAt: daysAgo(20),
      description:
        "Greenleaf Studio builds websites and apps for sustainable brands. As a Junior React Developer you'll pair with senior engineers on client projects.\n\nYou'll learn and work with React, Next.js and Tailwind CSS, write tests, and take part in code reviews. We value curiosity and good communication over years of experience.",
    },
  ];
}

async function listJobs(): Promise<ApiResult<JobPosting[]>> {
  await delay(700);
  return { ok: true, data: sampleJobs() };
}

// Jobs "posted" in this browser session, newest first.
const employerJobs: JobPosting[] = [
  {
    id: "posted_1",
    title: "Frontend Engineer",
    company: "Jane's Studio",
    location: "Berlin, Germany",
    description:
      "We're a small product studio looking for a frontend engineer to build web apps for our clients with React and TypeScript. You'll work directly with designers and clients, own features end to end, and help shape how we build.",
    applyUrl: "https://example.com/careers/frontend-engineer",
    source: "native",
    createdAt: daysAgo(4),
  },
];

// Like the API: only employer accounts can post or list their postings.
const EMPLOYER_ONLY: ApiError = { code: "EMPLOYER_ONLY", message: "Only employer accounts can post jobs" };
const isEmployer = () => readStoredUser()?.role === "EMPLOYER";

async function postJob(request: CreateJobPostingRequest): Promise<ApiResult<JobPosting>> {
  await delay(900);
  if (!isEmployer()) return fail(EMPLOYER_ONLY);
  if (request.title.toLowerCase().includes("fail")) {
    return fail({ code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." });
  }
  const job: JobPosting = { ...request, id: `posted_${Date.now()}`, source: "native", createdAt: new Date().toISOString() };
  employerJobs.unshift(job);
  return { ok: true, data: job };
}

async function listEmployerJobs(): Promise<ApiResult<JobPosting[]>> {
  await delay(600);
  if (!isEmployer()) return fail(EMPLOYER_ONLY);
  return { ok: true, data: [...employerJobs] };
}

function isNewUser(): boolean {
  return readStoredUser()?.email.toLowerCase().includes("new") ?? false;
}

function mockFile(tailoredResumeId: string, format: "docx" | "pdf", createdAt: string): GeneratedFile {
  return {
    id: `file_${tailoredResumeId}_${format}`,
    resumeId: "resume_mock_1",
    tailoredResumeId,
    format,
    fileName: `Jane_Doe_Resume.mock-${format}.txt`,
    downloadUrl: URL.createObjectURL(new Blob([`Mock ${format} for ${tailoredResumeId}`], { type: "text/plain" })),
    createdAt,
  };
}

const MOCK_HISTORY: { id: string; days: number; score: number | null }[] = [
  { id: "tailored_mock_3", days: 1, score: 88 },
  { id: "tailored_mock_2", days: 6, score: 64 },
  { id: "tailored_mock_1", days: 21, score: 42 },
  { id: "tailored_mock_0", days: 40, score: null }, // tailored before scores were saved
];

async function listTailoredResumes(): Promise<ApiResult<TailoredResumeWithFiles[]>> {
  await delay(700);
  if (isNewUser()) return { ok: true, data: [] };
  const base = sampleResume();
  return {
    ok: true,
    data: MOCK_HISTORY.map((r) => {
      const createdAt = daysAgo(r.days);
      return {
        id: r.id,
        userId: base.userId,
        sourceResumeId: base.id,
        gapAnalysisId: `analysis_${r.id}`,
        acceptedBulletIds: [],
        contact: base.contact,
        summary: base.summary,
        workExperience: base.workExperience,
        education: base.education,
        skills: base.skills,
        finalMatchPercent: r.score,
        createdAt,
        files: [mockFile(r.id, "docx", createdAt), mockFile(r.id, "pdf", createdAt)],
      };
    }),
  };
}

// A few of the seeded quotes, rotated the same way as the real endpoint.
const MOCK_QUOTES = [
  { text: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "The best way out is always through.", author: "Robert Frost" },
  { text: "Nothing will work unless you do.", author: "Maya Angelou" },
  { text: "Make each day your masterpiece.", author: "John Wooden" },
  { text: "Failure is simply the opportunity to begin again, this time more intelligently.", author: "Henry Ford" },
];

async function getRandomQuote(): Promise<ApiResult<RandomQuoteResponse>> {
  await delay(150);
  const { index, nextChangeAt } = quoteSlot(Date.now(), MOCK_QUOTES.length);
  return { ok: true, data: { quote: { id: index + 1, ...MOCK_QUOTES[index] }, nextChangeAt: new Date(nextChangeAt).toISOString() } };
}

async function getDashboardStats(): Promise<ApiResult<DashboardStats>> {
  await delay(500);
  const jobs = sampleJobs();
  const native = employerJobs.length;
  const external = jobs.length;
  if (isNewUser()) {
    return { ok: true, data: { tailoredResumeCount: 0, averageMatchPercent: null, jobs: { total: native + external, native, external } } };
  }
  const scores = MOCK_HISTORY.map((r) => r.score).filter((s): s is number => s !== null);
  return {
    ok: true,
    data: {
      tailoredResumeCount: MOCK_HISTORY.length,
      averageMatchPercent: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      jobs: { total: native + external, native, external },
    },
  };
}

// The profile, kept in memory for this page load. Like the server, it's created from the
// (sample) resume on first view and only changes through confirmResumeSync.
let mockProfile: ProfileValues = {};
let mockProfileSavedAt: string | null = null;
let mockLatestResume: Resume | null = null;

async function getProfile(): Promise<ApiResult<ProfileResponse>> {
  await delay(400);
  if (!mockProfileSavedAt && !isNewUser()) {
    mockProfile = profileFromResume(sampleResume());
    mockProfileSavedAt = new Date().toISOString();
  }
  const resume = mockProfileSavedAt ? (mockLatestResume ?? sampleResume()) : null;
  return { ok: true, data: { values: { ...mockProfile }, updatedAt: mockProfileSavedAt, resume } };
}

async function compareResume(file: File, onProgress?: (percent: number) => void): Promise<ApiResult<ResumeCompareResponse>> {
  const uploaded = await uploadResume(file, onProgress);
  if (!uploaded.ok) return uploaded;
  const r = uploaded.data;
  const draft = { sourceFileName: r.sourceFileName, contact: r.contact, summary: r.summary, workExperience: r.workExperience, education: r.education, skills: r.skills, certifications: r.certifications };
  const { changes } = syncProfileToResume(mockProfile, draft);
  const requiresConfirmation = changes.length > 0 && !isEmptyProfile(mockProfile);
  return { ok: true, data: { draft, changes, requiresConfirmation, syncToken: `mock.${Date.now()}` } };
}

async function confirmResumeSync(_file: File, compared: ResumeCompareResponse): Promise<ApiResult<ResumeSyncResponse>> {
  await delay(700);
  const { values, changes } = syncProfileToResume(mockProfile, compared.draft);
  mockProfile = values;
  mockProfileSavedAt = new Date().toISOString();
  const now = new Date().toISOString();
  const resume: Resume = { ...compared.draft, id: `resume_${Date.now()}`, userId: "user_mock_1", createdAt: now, updatedAt: now };
  mockLatestResume = resume;
  return { ok: true, data: { resume, profile: { values: { ...values }, updatedAt: mockProfileSavedAt, resume }, changes } };
}

// Learning paths, kept in memory for this page load.
let mockPaths: LearningPath[] = [];

async function getLearningInsights(): Promise<ApiResult<LearningInsights>> {
  await delay(500);
  if (isNewUser() && !mockLatestResume) {
    return { ok: true, data: { hasResume: false, marketReachPercent: 0, baselinePercent: null, jobsAnalyzed: 0, missingSkills: [], paths: [...mockPaths] } };
  }
  const reach = marketReach(mockLatestResume ?? sampleResume(), sampleJobs().map((j) => j.description));
  return {
    ok: true,
    data: { hasResume: true, marketReachPercent: reach.percent, baselinePercent: Math.max(0, reach.percent - 6), jobsAnalyzed: reach.jobsAnalyzed, missingSkills: reach.missingSkills, paths: [...mockPaths] },
  };
}

async function startLearning(skills: string[]): Promise<ApiResult<LearningPath[]>> {
  await delay(400);
  const now = new Date().toISOString();
  for (const skillName of skills) {
    if (!mockPaths.some((p) => p.skillName === skillName)) {
      mockPaths.push({ id: `path_${skillName}_${Date.now()}`, skillName, status: "interested", progress: 0, completedSteps: [], createdAt: now, updatedAt: now });
    }
  }
  return { ok: true, data: [...mockPaths] };
}

async function updateLearningPath(id: string, changes: UpdateLearningPathRequest): Promise<ApiResult<LearningPath>> {
  await delay(250);
  const path = mockPaths.find((p) => p.id === id);
  if (!path) return fail({ code: "PATH_NOT_FOUND", message: "That learning path was removed" });
  const steps = roadmapStepIds(path.skillName);
  const completedSteps = changes.completedSteps ?? path.completedSteps;
  const progress = Math.round((completedSteps.length / steps.length) * 100);
  const status = changes.status ?? (progress === 100 ? "completed" : progress > 0 ? "in_progress" : path.status === "completed" ? "in_progress" : path.status);
  const next: LearningPath = { ...path, completedSteps, progress, status, updatedAt: new Date().toISOString() };
  mockPaths = mockPaths.map((p) => (p.id === id ? next : p));
  return { ok: true, data: next };
}

async function removeLearningPath(id: string): Promise<ApiResult<null>> {
  await delay(250);
  mockPaths = mockPaths.filter((p) => p.id !== id);
  return { ok: true, data: null };
}

// Spreadsheet rows, kept in memory for this page load. Seeded on first use.
let mockSubmissions: Submission[] | null = null;

function mockSubmissionRows(): Submission[] {
  if (mockSubmissions) return mockSubmissions;
  if (isNewUser()) return (mockSubmissions = []);
  const resume = sampleResume();
  mockSubmissions = sampleJobs()
    .slice(0, 2)
    .map((job, i) => {
      const createdAt = daysAgo(i * 3 + 1);
      const cells = prefillSubmission(job, resume, null, mockProfile, new Date(createdAt));
      if (i === 1) {
        cells.submission.status = "Interview scheduled";
        cells.vendor = { vendorCompany: "Brightpath Staffing", vendorType: "Prime vendor", contactName: "Sam Lee", contactEmail: "sam@brightpath.example" };
      }
      return { id: `submission_mock_${i}`, jobId: job.id, ...cells, createdAt, updatedAt: createdAt };
    });
  return mockSubmissions;
}

async function listSubmissions(): Promise<ApiResult<Submission[]>> {
  await delay(500);
  return { ok: true, data: [...mockSubmissionRows()] };
}

async function createSubmission(request: CreateSubmissionRequest): Promise<ApiResult<CreateSubmissionResponse>> {
  await delay(400);
  const rows = mockSubmissionRows();
  const existing = request.jobId ? rows.find((r) => r.jobId === request.jobId) : undefined;
  if (existing) return { ok: true, data: { submission: existing, created: false } };
  const job = request.jobId ? [...sampleJobs(), ...employerJobs].find((j) => j.id === request.jobId) : undefined;
  if (request.jobId && !job) return fail({ code: "JOB_NOT_FOUND", message: "That job is no longer listed" });
  const now = new Date().toISOString();
  const cells = job ? prefillSubmission(job, sampleResume(), null, mockProfile) : { vendor: {}, submission: {}, skills: {}, client: {} };
  const submission: Submission = { id: `submission_${Date.now()}`, jobId: job?.id ?? null, ...cells, createdAt: now, updatedAt: now };
  rows.unshift(submission);
  return { ok: true, data: { submission, created: true } };
}

async function updateSubmission(id: string, changes: UpdateSubmissionRequest): Promise<ApiResult<Submission>> {
  await delay(300);
  const rows = mockSubmissionRows();
  const index = rows.findIndex((r) => r.id === id);
  if (index < 0) return fail({ code: "SUBMISSION_NOT_FOUND", message: "That row was deleted" });
  const next: Submission = { ...rows[index], updatedAt: new Date().toISOString() };
  for (const sheet of SHEETS) {
    if (!changes[sheet.key]) continue;
    const { values, fieldErrors } = validateSheetValues(sheet, changes[sheet.key]);
    if (Object.values(values).some((v) => v.toLowerCase().includes("fail"))) {
      return fail({ code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." });
    }
    if (Object.keys(fieldErrors).length) {
      return fail({ code: "VALIDATION_ERROR", message: "Please fix the highlighted cells", fieldErrors });
    }
    const merged = { ...next[sheet.key], ...values };
    for (const [key, value] of Object.entries(merged)) if (!value) delete merged[key];
    next[sheet.key] = merged;
  }
  rows[index] = next;
  return { ok: true, data: next };
}

async function deleteSubmission(id: string): Promise<ApiResult<null>> {
  await delay(300);
  mockSubmissions = mockSubmissionRows().filter((r) => r.id !== id);
  return { ok: true, data: null };
}

async function exportSubmissions(): Promise<ApiResult<Blob>> {
  const bytes = await buildSubmissionWorkbook(mockSubmissionRows());
  return { ok: true, data: new Blob([new Uint8Array(bytes)], { type: XLSX_MIME }) };
}

export const mockApi = {
  getRandomQuote,
  register,
  login,
  logout,
  getAccount,
  updateAccount,
  saveResume,
  addSkills,
  analyzeGap,
  generateSummaries,
  saveSummary,
  tailorResume,
  listJobs,
  postJob,
  listEmployerJobs,
  getDashboardStats,
  listTailoredResumes,
  getProfile,
  compareResume,
  confirmResumeSync,
  getLearningInsights,
  startLearning,
  updateLearningPath,
  removeLearningPath,
  listSubmissions,
  createSubmission,
  updateSubmission,
  deleteSubmission,
  exportSubmissions,
};
