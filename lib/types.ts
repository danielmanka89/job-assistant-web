// Shared contract for the whole app. Every API response must conform to these types.
// Only Daniel edits this file.
//
// Date convention: resume dates are strings in "YYYY-MM" format.
// If the parser finds only a year (e.g. "2021"), it returns "YYYY-01" (e.g. "2021-01").

/** Error body returned by every API route on failure (non-2xx status). */
export interface ApiError {
  code: string; // machine-readable, e.g. "INVALID_CREDENTIALS"
  message: string; // human-readable, safe to show the user
}

/** A registered user. Never includes the password hash. */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string; // ISO 8601
}

/** Input for creating an account. Password is hashed with bcrypt before storage. */
export interface RegisterRequest {
  email: string;
  password: string; // plain text over HTTPS only; never stored or returned
  name: string;
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
  bullets: string[]; // user-provided achievement lines
}

/** One education entry on a resume. */
export interface Education {
  id: string;
  institution: string;
  degree: string; // e.g. "B.Sc."
  fieldOfStudy?: string;
  startDate?: string; // "YYYY-MM"; year-only input becomes "YYYY-01"
  endDate?: string; // "YYYY-MM" (graduation or expected graduation); year-only input becomes "YYYY-01"; omitted if unknown
}

/** A parsed resume belonging to a user. */
export interface Resume {
  id: string;
  userId: string;
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
  suggestedBullets: SuggestedBullet[];
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
  createdAt: string; // ISO 8601
}

/** Returned by the tailoring endpoint for a TailoredResumeRequest. */
export interface TailoredResumeResponse {
  tailoredResume: TailoredResume;
  files: GeneratedFile[]; // one per requested format
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
