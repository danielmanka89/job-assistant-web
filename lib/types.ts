// Shared contract for the whole app. Every API response must conform to these types.
// Only Daniel edits this file.
//
// Date convention: resume dates are strings in "YYYY-MM" format.
// If the parser finds only a year (e.g. "2021"), it returns "YYYY-01" (e.g. "2021-01").

/** Error body returned by every API route on failure (non-2xx status). */
export interface ApiError {
  code: string; // machine-readable, e.g. "INVALID_CREDENTIALS"
  message: string; // human-readable, safe to show the user
  fieldErrors?: Record<string, string>; // per-field validation errors, e.g. { email: "Already registered" }
}

/** A registered user. Never includes the password hash. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string; // ISO 8601
}

/** Job seekers tailor resumes; employers can also post jobs and see their own postings. */
export type UserRole = "SEEKER" | "EMPLOYER";

/** Input for creating an account. Password is hashed with bcrypt before storage. */
export interface RegisterRequest {
  email: string;
  password: string; // plain text over HTTPS only; never stored or returned
  name: string;
  role?: UserRole; // defaults to "SEEKER"
}

/** Input for signing in. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Returned on successful register or login. The session is set as an HTTP-only cookie. */
export interface AuthResponse {
  user: User;
}

/**
 * Input for PATCH /api/account. Send only the fields being changed.
 * Changing email or password requires currentPassword; a new password signs out the user's other sessions.
 */
export interface UpdateAccountRequest {
  name?: string;
  email?: string;
  newPassword?: string; // plain text over HTTPS only; hashed with bcrypt before storage
  currentPassword?: string; // required when email or newPassword is sent
}

/** Returned by GET and PATCH /api/account: the logged-in user as stored. */
export interface AccountResponse {
  user: User;
}

/** Contact details shown at the top of a resume. */
export interface ResumeContact {
  fullName: string;
  email: string;
  phone?: string;
  location?: string; // e.g. "Berlin, Germany"
  linkedinUrl?: string;
  websiteUrl?: string;
}

/** One job entry on a resume. */
export interface WorkExperience {
  id: string;
  jobTitle: string;
  company: string;
  location?: string;
  startDate: string; // "YYYY-MM"; year-only input becomes "YYYY-01"
  endDate: string | null; // "YYYY-MM"; year-only input becomes "YYYY-01"; null if current role
  bullets: {
    id: string; // stable id so specific bullets can be targeted
    text: string; // user-provided achievement line
  }[];
}

/** One education entry on a resume. */
export interface Education {
  id: string;
  institution: string;
  degree: string; // e.g. "B.Sc."
  fieldOfStudy?: string;
  startDate?: string; // "YYYY-MM"; year-only input becomes "YYYY-01"
  endDate?: string | null; // "YYYY-MM" (graduation date); year-only input becomes "YYYY-01"; null if in progress; omitted if unknown
}

/** A parsed resume belonging to a user. */
export interface Resume {
  id: string;
  userId: string;
  sourceFileName?: string; // original upload name, e.g. "Jane_Doe_CV.pdf"; accepted formats: PDF and DOCX
  contact: ResumeContact;
  summary?: string;
  workExperience: WorkExperience[];
  education: Education[];
  skills: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** Input for comparing a resume against a job description. */
export interface GapAnalysisRequest {
  resumeId: string;
  jobDescription: string; // raw pasted text
}

/** An AI-proposed rewording of one existing bullet. Never adds new facts. */
export interface SuggestedBullet {
  id: string;
  workExperienceId: string; // the WorkExperience this bullet belongs to
  originalText: string; // the user's bullet as written on the resume
  text: string; // proposed bullet wording
  reason: string; // why it helps for this job
}

/** AI gap analysis result. Suggested bullets only rephrase/reorder user content. */
export interface GapAnalysisResponse {
  id: string; // gap analysis id
  matchedKeywords: string[]; // in both the job description and the resume
  missingKeywords: string[]; // in the job description but not the resume
  matchPercent: number; // matched / (matched + missing), rounded; 0 when no keywords
  suggestedBullets: SuggestedBullet[];
}

/** Input for POST /api/summary-generate. */
export interface SummaryGenerateRequest {
  resumeId: string;
  jobDescription: string; // raw pasted text
}

/** Three alternative summaries, always in this order: leadership, technical depth, industry fit. */
export interface SummaryGenerateResponse {
  options: string[];
}

/** Input for PATCH /api/resumes/:id/summary. */
export interface UpdateSummaryRequest {
  newSummary: string;
}

/** Input for PATCH /api/resumes/:id: skills to append (case-insensitive duplicates are skipped). */
export interface AddSkillsRequest {
  newSkills: string[];
}

/** Input for building the tailored resume from the user's selections. */
export interface TailoredResumeRequest {
  resumeId: string;
  gapAnalysisId: string; // GapAnalysisResponse.id the accepted bullets came from
  jobDescription: string;
  acceptedBulletIds: string[]; // only these suggested bullets get merged
  formats: ("docx" | "pdf")[];
}

/** The "after" state: the original resume with only the user-accepted bullets merged in. */
export interface TailoredResume {
  id: string;
  userId: string;
  sourceResumeId: string; // the original Resume this was built from
  gapAnalysisId: string; // the GapAnalysisResponse the bullets came from
  acceptedBulletIds: string[]; // SuggestedBullet ids the user selected
  contact: ResumeContact;
  summary?: string;
  workExperience: WorkExperience[]; // accepted bullets replace their originalText
  education: Education[];
  skills: string[];
  finalMatchPercent: number | null; // same score as TailoredResumeResponse.finalMatchPercent; null on older rows
  createdAt: string; // ISO 8601
}

/** Returned by the tailoring endpoint for a TailoredResumeRequest. */
export interface TailoredResumeResponse {
  tailoredResume: TailoredResume;
  files: GeneratedFile[]; // one per requested format
  // The analysis's keywords found in the text read back from the generated file (PDF when requested),
  // the same way an uploaded resume is read. matched / (matched + missing), rounded; 0 when no keywords.
  finalMatchPercent: number;
}

/** A tailored resume with its downloadable files, as listed by GET /api/tailored-resumes. */
export interface TailoredResumeWithFiles extends TailoredResume {
  files: GeneratedFile[];
}

/** GET /api/tailored-resumes response: the user's tailored resumes, newest first. */
export interface TailoredResumeListResponse {
  tailoredResumes: TailoredResumeWithFiles[];
}

/** GET /api/dashboard-stats response. */
export interface DashboardStats {
  tailoredResumeCount: number;
  averageMatchPercent: number | null; // mean finalMatchPercent, rounded; null when no resume has a score
  jobs: {
    total: number;
    native: number; // posted on this site
    external: number; // pulled from a provider (including "mock" demo jobs)
  };
}

/** A generated resume file ready for download. */
export interface GeneratedFile {
  id: string;
  resumeId: string;
  tailoredResumeId: string; // the TailoredResume this file was rendered from
  format: "docx" | "pdf";
  fileName: string; // e.g. "Jane_Doe_Resume.pdf"
  downloadUrl: string;
  createdAt: string; // ISO 8601
}

/** Where a job came from: posted on this site, or pulled from an external provider. */
export type JobSource = "native" | "adzuna" | "mock";

/** A job listing. "mock" jobs are demo data, not real openings. */
export interface JobPosting {
  id: string;
  title: string;
  company: string;
  location: string; // e.g. "Berlin, Germany" or "Remote"
  description: string; // full job description; can be used directly for gap analysis
  applyUrl: string; // http(s) link to the application page
  source: JobSource;
  createdAt: string; // ISO 8601
}

/** Input for posting a job directly on the site (POST /api/jobs). */
export interface CreateJobPostingRequest {
  title: string;
  company: string;
  location: string;
  description: string; // 50-20,000 characters, same limits as gap analysis
  applyUrl: string; // must start with http:// or https://
}

/** Returned by GET /api/jobs: native and external jobs, newest first. */
export interface JobListResponse {
  jobs: JobPosting[];
}

/** The four sheets of the Spreadsheet page. Every submission has one row on each. */
export type SheetKey = "vendor" | "submission" | "skills" | "client";

/** One sheet's cells for a submission: column key -> text. Column keys are listed in lib/spreadsheet.ts. */
export type SheetValues = Record<string, string>;

/**
 * A job application. Created when the user clicks Apply on a job (prefilled from the job and their
 * latest resume) or added by hand on the Spreadsheet page; every cell can be edited afterwards.
 */
export interface Submission {
  id: string;
  jobId: string | null; // the JobPosting applied to; null for rows added by hand
  vendor: SheetValues;
  submission: SheetValues;
  skills: SheetValues;
  client: SheetValues;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** Returned by GET /api/submissions: the user's submissions, newest first. */
export interface SubmissionListResponse {
  submissions: Submission[];
}

/** POST /api/submissions. With jobId the row is prefilled from that job; without it the row starts blank. */
export interface CreateSubmissionRequest {
  jobId?: string;
}

/** Returned by POST /api/submissions. created is false when the user had already applied to the job. */
export interface CreateSubmissionResponse {
  submission: Submission;
  created: boolean;
}

/**
 * PATCH /api/submissions/:id: cells to change, by sheet. Only the given cells change; "" clears one.
 * Returns the updated Submission.
 */
export type UpdateSubmissionRequest = Partial<Record<SheetKey, SheetValues>>;

/** The job seeker's saved profile: field key -> text. Field keys are listed in lib/profile.ts. */
export type ProfileValues = Record<string, string>;

/**
 * Returned by GET and PUT /api/profile. updatedAt is null until the profile is first saved;
 * suggestions (from the account and latest resume) are for filling an empty profile.
 */
export interface ProfileResponse {
  values: ProfileValues;
  updatedAt: string | null;
  suggestions: ProfileValues;
}

/** PUT /api/profile: the whole profile. Fields left out or blank are cleared. */
export interface UpdateProfileRequest {
  values: ProfileValues;
}
