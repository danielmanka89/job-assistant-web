// Shared contract for the whole app. Every API response must conform to these types.
// Only Daniel edits this file.

/** A registered user. Never includes the password hash. */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string; // ISO 8601
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
  startDate: string; // "YYYY-MM"
  endDate: string | null; // "YYYY-MM", or null if current role
  bullets: string[]; // user-provided achievement lines
}

/** One education entry on a resume. */
export interface Education {
  id: string;
  institution: string;
  degree: string; // e.g. "B.Sc."
  fieldOfStudy?: string;
  startDate?: string; // "YYYY-MM"
  endDate?: string; // "YYYY-MM"
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

/** AI gap analysis result. Suggested bullets only rephrase/reorder user content. */
export interface GapAnalysisResponse {
  matchedKeywords: string[]; // in both the job description and the resume
  missingKeywords: string[]; // in the job description but not the resume
  suggestedBullets: {
    id: string;
    text: string; // proposed bullet wording
    reason: string; // why it helps for this job
  }[];
}

/** Input for building the tailored resume from the user's selections. */
export interface TailoredResumeRequest {
  resumeId: string;
  jobDescription: string;
  acceptedBulletIds: string[]; // only these suggested bullets get merged
  formats: ("docx" | "pdf")[];
}

/** A generated resume file ready for download. */
export interface GeneratedFile {
  id: string;
  resumeId: string;
  format: "docx" | "pdf";
  fileName: string; // e.g. "Jane_Doe_Resume.pdf"
  downloadUrl: string;
  createdAt: string; // ISO 8601
}
