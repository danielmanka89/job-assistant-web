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
  clockTemplate: ClockTemplate;
  themeColor: ThemeColor;
  profilePictureUrl: string | null; // the portfolio photo, or null to show initials
  avatarUrl: string | null; // the menu photo; null falls back to the portfolio photo
  createdAt: string; // ISO 8601
}

/** How the live clocks at the top of the dashboard sidebar look; chosen in Settings. */
export type ClockTemplate = "MINIMALIST" | "NEON" | "GLASS";
export const CLOCK_TEMPLATES: readonly ClockTemplate[] = ["MINIMALIST", "NEON", "GLASS"];

/** The candidate's color theme for the whole app, clocks included; chosen in Settings. Red is the default. */
export type ThemeColor = "BLUE" | "GREEN" | "RED";
export const THEME_COLORS: readonly ThemeColor[] = ["BLUE", "GREEN", "RED"];

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
  clockTemplate?: ClockTemplate;
  themeColor?: ThemeColor;
}

/** A motivational quote shown in the banner at the bottom of the dashboard. */
export interface Quote {
  id: number;
  text: string;
  author: string | null;
}

/** Returned by GET /api/quotes/random. */
export interface RandomQuoteResponse {
  quote: Quote;
  serverTime: string; // ISO 8601; the banner times its changes by the server's clock, not the device's
  nextChangeAt: string; // ISO 8601; when every user's banner moves to the next quote
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
  workAuthorization?: string; // visa / work authorization, only if the resume states it, e.g. "H-1B"
  desiredPay?: string; // pay rate or salary the candidate asks for, only if the resume states it
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
  certifications?: string[]; // omitted for resumes uploaded before certifications were read
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
 * Returned by GET /api/profile. The profile comes only from the resume and can't be edited;
 * updatedAt is null when there's no resume yet.
 */
export interface ProfileResponse {
  values: ProfileValues;
  updatedAt: string | null;
  resume: Resume | null; // the latest resume, shown in full on the Profile page
  publishedAt: string | null; // when the public portfolio was shared; null while it's private
}

/**
 * The candidate's public portfolio, from GET /api/profile/public/[userId] (no login needed). Only
 * candidates who approved sharing have one. Work authorization and pay rate are left out on purpose.
 */
export interface PublicPortfolio {
  userId: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  websiteUrl: string;
  summary: string;
  skills: string[];
  certifications: string[];
  workExperience: Pick<WorkExperience, "jobTitle" | "company" | "location" | "startDate" | "endDate">[];
  education: Pick<Education, "institution" | "degree" | "fieldOfStudy" | "startDate" | "endDate">[];
  resumeFileName: string | null; // the original upload, if there is one to download
  themeColor: ThemeColor; // the portfolio is shown in its owner's theme color
  profilePictureUrl: string | null; // shown in the portrait circle; null shows initials
  profilePictureSize: { width: number; height: number } | null; // a tall or wide photo is shown at its own shape
}

/** The interview introduction from GET/POST /api/profile/introduction. */
export interface IntroductionResponse {
  introduction: {
    paragraphs: string[];
    wordCount: number;
    createdAt: string; // ISO 8601
    upToDate: boolean; // false when it was written from an older resume
  } | null;
  hasResume: boolean;
}

/** What someone is to you when you connect with them. */
export const CONNECTION_KINDS = ["friend", "vendor", "employer", "recruiter", "colleague", "other"] as const;
export type ConnectionKind = (typeof CONNECTION_KINDS)[number];
export const CONNECTION_KIND_LABEL: Record<ConnectionKind, string> = {
  friend: "Friend",
  vendor: "Vendor",
  employer: "Employer",
  recruiter: "Recruiter",
  colleague: "Colleague",
  other: "Other",
};

/** Another user, as shown in Chat. Connections are one-way, so the two directions are separate. */
export interface Person {
  id: string;
  name: string;
  role: UserRole;
  connection: ConnectionKind | null; // how you're connected to them; null when you aren't
  connectedToMe: boolean; // whether they're connected to you
}

/** GET /api/connections: the people you're connected to, and the people connected to you. */
export interface ConnectionsResponse {
  connectedTo: Person[];
  connectedToMe: Person[];
}

/** GET /api/people?q=: users whose name matches, or whose email is exactly q. */
export interface PeopleSearchResponse {
  people: Person[];
}

/** POST /api/connections: connect to someone, or change what they are to you. */
export interface ConnectRequest {
  userId: string;
  kind: ConnectionKind;
}

/** GET /api/chat/summary: the numbers shown in the menu. */
export interface ChatSummary {
  unread: number; // unread messages across all chats
  connectedTo: number;
  connectedToMe: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string; // ISO 8601
}

export interface ChatConversation {
  id: string;
  person: Person;
  lastMessage: string | null;
  lastMessageAt: string; // ISO 8601
  unread: number;
}

/** GET /api/chat: your chats, most recent first. */
export interface ChatListResponse {
  conversations: ChatConversation[];
}

/** GET /api/chat/:id. With ?after=<ISO time> only newer messages are returned. */
export interface ChatThreadResponse {
  id: string;
  person: Person;
  canSend: boolean; // false once neither of you is connected to the other
  messages: ChatMessage[];
}

export const MAX_MESSAGE_CHARS = 2000;

/** What a mock call question is about. */
export const PREP_CATEGORIES = ["job", "experience", "projects", "skills", "summary"] as const;
export type PrepCategory = (typeof PREP_CATEGORIES)[number];

export interface PrepQuestion {
  category: PrepCategory;
  question: string;
  answer: string; // a first-person answer the candidate can practise
}

/** Mock call preparation for one submission, from GET/POST /api/submissions/:id/prep. */
export interface MockCallPrepResponse {
  job: { title: string; company: string };
  hasResume: boolean;
  hasJobDescription: boolean; // false for a row added by hand until a job description is pasted
  prep: {
    questions: PrepQuestion[];
    createdAt: string; // ISO 8601
    upToDate: boolean; // false when it was written from an older resume
  } | null;
}

/** POST /api/submissions/:id/prep. jobDescription is only needed for rows that have no job posting. */
export interface WriteMockCallPrepRequest {
  jobDescription?: string;
}

/** Returned by POST and DELETE /api/profile/public: whether the portfolio is shared, and its link. */
export interface PortfolioStatusResponse {
  userId: string;
  path: string; // "/profile/<userId>"
  publishedAt: string | null;
}

/** A resume read from an uploaded file but not saved yet (POST /api/resume/compare). */
export type ResumeDraft = Omit<Resume, "id" | "userId" | "createdAt" | "updatedAt">;

/** One profile field the uploaded resume would change. "" means empty. */
export interface ProfileChange {
  field: string; // profile field key, e.g. "phone"
  label: string; // e.g. "Phone"
  from: string; // current profile value
  to: string; // value from the resume
}

/**
 * Returned by POST /api/resume/compare: the parsed resume (not saved), how it would change the
 * profile, and a token that POST /api/resume/confirm-sync needs, valid for one hour.
 * requiresConfirmation is true when an existing profile would change: the user must confirm the
 * changes, or the resume isn't added. The first resume fills an empty profile without asking.
 */
export interface ResumeCompareResponse {
  draft: ResumeDraft;
  changes: ProfileChange[];
  requiresConfirmation: boolean;
  syncToken: string;
}

/** Returned by POST /api/resume/confirm-sync: the saved resume and the updated profile. */
export interface ResumeSyncResponse {
  resume: Resume;
  profile: ProfileResponse;
  changes: ProfileChange[];
}

/** A skill the candidate's resume doesn't show that open jobs ask for. */
export interface MissingSkill {
  skill: string; // e.g. "AWS"
  jobCount: number; // open jobs on the Job Board that mention it
  gainPercent: number; // roughly how much Market Reach would rise with it
}

export type LearningStatus = "interested" | "in_progress" | "completed";

/** A skill the user chose to learn, with their progress through its roadmap. */
export interface LearningPath {
  id: string;
  skillName: string;
  status: LearningStatus;
  progress: number; // 0-100
  completedSteps: string[]; // roadmap step ids the user ticked
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Returned by GET /api/learning: Market Reach from the latest resume against open jobs, the
 * missing skills worth learning, and the user's learning paths. hasResume is false until a
 * resume is uploaded, and the numbers are then 0 and empty.
 */
export interface LearningInsights {
  hasResume: boolean;
  marketReachPercent: number;
  baselinePercent: number | null; // Market Reach when the latest resume was uploaded
  jobsAnalyzed: number;
  missingSkills: MissingSkill[];
  paths: LearningPath[];
}

/** POST /api/learning/paths: start learning these skills (already-started ones are kept as they are). */
export interface StartLearningRequest {
  skills: string[];
}

/** PATCH /api/learning/paths/:id: tick roadmap steps or change the status. Progress follows the steps. */
export interface UpdateLearningPathRequest {
  status?: LearningStatus;
  completedSteps?: string[];
}

/** Where a deadline tracker item comes from: a Spreadsheet row, a learning path or the user's own list. */
export type DeadlineKind = "interview" | "follow_up" | "learning" | "custom";

/** One item in the sidebar's deadline tracker. */
export interface DeadlineItem {
  id: string; // unique across kinds, e.g. "interview:<submissionId>"; custom items use "custom:<deadlineId>"
  kind: DeadlineKind;
  title: string;
  detail: string;
  dueOn: string | null; // "YYYY-MM-DD"; null for learning paths, which have no date
  progress: number | null; // 0-100 for learning paths
  done: boolean; // only custom items can be done
  href: string | null; // the page the item opens
}

/** Returned by GET /api/deadlines. */
export interface DeadlineListResponse {
  items: DeadlineItem[];
}

/** POST /api/deadlines: adds one of the user's own deadlines. */
export interface CreateDeadlineRequest {
  title: string;
  dueOn: string; // "YYYY-MM-DD"
}

/** PATCH /api/deadlines/:id. */
export interface UpdateDeadlineRequest {
  done: boolean;
}
