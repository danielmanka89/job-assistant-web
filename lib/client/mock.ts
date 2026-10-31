// Local stand-ins for the backend so the UI can be built before the API exists.
// Enabled with NEXT_PUBLIC_MOCK_API=true. Handy test inputs:
//   register with taken@example.com  -> "email already registered" field error
//   login with password "wrongpass"  -> invalid credentials error
//   upload a file with "fail" in its name -> parse error
//   gap analysis with "fail" in the job description -> analysis error
import type {
  ApiError,
  AuthResponse,
  GapAnalysisRequest,
  GapAnalysisResponse,
  LoginRequest,
  RegisterRequest,
  Resume,
  User,
} from "@/lib/types";
import type { ApiResult } from "./api";
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

function mockUser(email: string, name: string): User {
  return {
    id: "user_mock_1",
    email,
    name,
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
  return { ok: true, data: { user: mockUser(payload.email, payload.name) } };
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
  return { ok: true, data: { user: mockUser(payload.email, "Jane Doe") } };
}

async function logout(): Promise<void> {
  await delay(150);
  clearMockSession();
}

async function uploadResume(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ApiResult<Resume>> {
  for (let p = 0; p <= 100; p += 10) {
    onProgress?.(p);
    await delay(90);
  }
  await delay(400);

  if (file.name.toLowerCase().includes("fail")) {
    return fail({
      code: "PARSE_FAILED",
      message: "We couldn't read this resume. Try exporting it again as PDF or DOCX.",
    });
  }

  return { ok: true, data: sampleResume(file.name) };
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
    createdAt: now,
    updatedAt: now,
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
    ...resume.skills,
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

export const mockApi = { register, login, logout, uploadResume, saveResume, analyzeGap };
