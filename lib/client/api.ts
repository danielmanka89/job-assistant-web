import type {
  AccountResponse,
  AddSkillsRequest,
  ApiError,
  AuthResponse,
  CreateDeadlineRequest,
  CreateSubmissionRequest,
  DeadlineItem,
  CreateSubmissionResponse,
  GapAnalysisRequest,
  CreateJobPostingRequest,
  DashboardStats,
  GapAnalysisResponse,
  JobPosting,
  LearningInsights,
  LearningPath,
  LoginRequest,
  IntroductionResponse,
  ChatConversation,
  ChatMessage,
  ChatSummary,
  ChatThreadResponse,
  ConnectRequest,
  ConnectionsResponse,
  EmailDetail,
  EmailListResponse,
  EmailSummary,
  SendEmailRequest,
  Person,
  MockCallPrepResponse,
  WriteMockCallPrepRequest,
  PortfolioStatusResponse,
  ProfileResponse,
  RandomQuoteResponse,
  RegisterRequest,
  Resume,
  ResumeCompareResponse,
  ResumeSyncResponse,
  Submission,
  SummaryGenerateRequest,
  SummaryGenerateResponse,
  TailoredResumeRequest,
  TailoredResumeResponse,
  TailoredResumeWithFiles,
  StartLearningRequest,
  UpdateAccountRequest,
  UpdateLearningPathRequest,
  UpdateSubmissionRequest,
  UpdateSummaryRequest,
} from "@/lib/types";
import { clearUser } from "./current-user";
import { toDashboardStats, toTailoredResumeList } from "./dashboard";
import { toJobList } from "./jobs";
import { toCreateSubmissionResponse, toSubmission, toSubmissionList } from "./submissions";
import { mockApi } from "./mock";
import { customDeadlineId } from "@/lib/deadlines";
import { toDeadlineItem, toDeadlineList } from "./deadlines";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

// Set NEXT_PUBLIC_MOCK_API=true in .env to run the UI without the backend.
export const USE_MOCK_API = process.env.NEXT_PUBLIC_MOCK_API === "true";

const NETWORK_ERROR: ApiError = {
  code: "NETWORK_ERROR",
  message: "We couldn't reach the server. Check your connection and try again.",
};

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === "string" && typeof v.message === "string";
}

function toApiError(body: unknown, status: number): ApiError {
  if (isApiError(body)) return body;
  return {
    code: `HTTP_${status}`,
    message: "Something went wrong on our side. Please try again.",
  };
}

function postJson<TReq, TRes>(url: string, payload: TReq): Promise<ApiResult<TRes>> {
  return sendJson<TReq, TRes>("POST", url, payload);
}

async function sendJson<TReq, TRes>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload: TReq,
): Promise<ApiResult<TRes>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: toApiError(body, res.status) };
  return { ok: true, data: body as TRes };
}

async function getJson(url: string): Promise<ApiResult<unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: toApiError(body, res.status) };
  return { ok: true, data: body };
}

/** Lists open jobs from GET /api/jobs. */
export async function listJobs(): Promise<ApiResult<JobPosting[]>> {
  if (USE_MOCK_API) return mockApi.listJobs();
  const result = await getJson("/api/jobs");
  return result.ok ? { ok: true, data: toJobList(result.data) } : result;
}

/** Posts a job on the site with POST /api/jobs. Requires login. */
export function postJob(request: CreateJobPostingRequest): Promise<ApiResult<JobPosting>> {
  if (USE_MOCK_API) return mockApi.postJob(request);
  return postJson<CreateJobPostingRequest, JobPosting>("/api/jobs", request);
}

/** Jobs the logged-in employer has posted, from GET /api/employer/jobs ({ jobs: [...] }). */
export async function listEmployerJobs(): Promise<ApiResult<JobPosting[]>> {
  if (USE_MOCK_API) return mockApi.listEmployerJobs();
  const result = await getJson("/api/employer/jobs");
  return result.ok ? { ok: true, data: toJobList(result.data) } : result;
}

/** Totals for the dashboard cards, from GET /api/dashboard-stats. */
export async function getDashboardStats(): Promise<ApiResult<DashboardStats>> {
  if (USE_MOCK_API) return mockApi.getDashboardStats();
  const result = await getJson("/api/dashboard-stats");
  return result.ok ? { ok: true, data: toDashboardStats(result.data) } : result;
}

/** Sets the portfolio photo (PUT /api/profile/photo, multipart) and returns the updated user. */
export function uploadProfilePhoto(photo: Blob, size?: { width: number; height: number }): Promise<ApiResult<AccountResponse>> {
  if (USE_MOCK_API) return mockApi.uploadProfilePhoto(photo);
  return putPhoto("/api/profile/photo", photo, size);
}

/** Sets the menu photo (PUT /api/profile/avatar, multipart) and returns the updated user. */
export function uploadAvatarPhoto(photo: Blob): Promise<ApiResult<AccountResponse>> {
  if (USE_MOCK_API) return mockApi.uploadAvatarPhoto(photo);
  return putPhoto("/api/profile/avatar", photo);
}

/** Removes the menu photo (DELETE /api/profile/avatar); the menu shows the portfolio photo again. */
export function removeAvatarPhoto(): Promise<ApiResult<AccountResponse>> {
  if (USE_MOCK_API) return mockApi.removeAvatarPhoto();
  return sendJson<Record<string, never>, AccountResponse>("DELETE", "/api/profile/avatar", {});
}

async function putPhoto(url: string, photo: Blob, size?: { width: number; height: number }): Promise<ApiResult<AccountResponse>> {
  const form = new FormData();
  form.append("file", photo, "photo");
  if (size) {
    form.append("width", String(size.width));
    form.append("height", String(size.height));
  }
  let res: Response;
  try {
    res = await fetch(url, { method: "PUT", body: form, credentials: "same-origin" });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: toApiError(body, res.status) };
  return { ok: true, data: body as AccountResponse };
}

/** Removes the portfolio photo (DELETE /api/profile/photo); initials show again. */
export function removeProfilePhoto(): Promise<ApiResult<AccountResponse>> {
  if (USE_MOCK_API) return mockApi.removeProfilePhoto();
  return sendJson<Record<string, never>, AccountResponse>("DELETE", "/api/profile/photo", {});
}

/** The banner's current quote from GET /api/quotes/random. */
export async function getRandomQuote(): Promise<ApiResult<RandomQuoteResponse>> {
  if (USE_MOCK_API) return mockApi.getRandomQuote();
  const result = await getJson("/api/quotes/random");
  if (!result.ok) return result;
  const body = result.data as Partial<RandomQuoteResponse> | null;
  const quote = body?.quote;
  if (!quote || typeof quote.text !== "string") return { ok: false, error: { code: "BAD_RESPONSE", message: "Unexpected quote response" } };
  return {
    ok: true,
    data: {
      quote: { id: Number(quote.id), text: quote.text, author: typeof quote.author === "string" ? quote.author : null },
      serverTime: typeof body.serverTime === "string" ? body.serverTime : new Date().toISOString(),
      nextChangeAt: typeof body.nextChangeAt === "string" ? body.nextChangeAt : new Date().toISOString(),
    },
  };
}

/** The user's tailored resumes, newest first, from GET /api/tailored-resumes ({ tailoredResumes: [...] }). */
export async function listTailoredResumes(): Promise<ApiResult<TailoredResumeWithFiles[]>> {
  if (USE_MOCK_API) return mockApi.listTailoredResumes();
  const result = await getJson("/api/tailored-resumes");
  return result.ok ? { ok: true, data: toTailoredResumeList(result.data) } : result;
}

/** The logged-in user, from GET /api/account. */
export async function getAccount(): Promise<ApiResult<AccountResponse>> {
  if (USE_MOCK_API) return mockApi.getAccount();
  const result = await getJson("/api/account");
  return result.ok ? { ok: true, data: result.data as AccountResponse } : result;
}

/** Changes name, email and/or password with PATCH /api/account and returns the updated user. */
export function updateAccount(request: UpdateAccountRequest): Promise<ApiResult<AccountResponse>> {
  if (USE_MOCK_API) return mockApi.updateAccount(request);
  return sendJson<UpdateAccountRequest, AccountResponse>("PATCH", "/api/account", request);
}

function toProfileResponse(body: unknown): ProfileResponse {
  const b = (body ?? {}) as Partial<Record<keyof ProfileResponse, unknown>>;
  const values =
    b.values && typeof b.values === "object" && !Array.isArray(b.values)
      ? Object.fromEntries(Object.entries(b.values).filter((e): e is [string, string] => typeof e[1] === "string"))
      : {};
  const resume = b.resume && typeof b.resume === "object" && (b.resume as Resume).contact ? (b.resume as Resume) : null;
  return {
    values,
    updatedAt: typeof b.updatedAt === "string" ? b.updatedAt : null,
    resume,
    publishedAt: typeof b.publishedAt === "string" ? b.publishedAt : null,
  };
}

/** The saved interview introduction, if any (GET /api/profile/introduction). */
export async function getIntroduction(): Promise<ApiResult<IntroductionResponse>> {
  if (USE_MOCK_API) return mockApi.getIntroduction();
  const result = await getJson("/api/profile/introduction");
  return result.ok ? { ok: true, data: result.data as IntroductionResponse } : result;
}

/** Writes (or rewrites) the introduction from the latest resume (POST /api/profile/introduction); takes up to a minute. */
export function writeIntroduction(): Promise<ApiResult<IntroductionResponse>> {
  if (USE_MOCK_API) return mockApi.writeIntroduction();
  return sendJson<Record<string, never>, IntroductionResponse>("POST", "/api/profile/introduction", {});
}

/** Approves sharing (POST) or makes the public portfolio private again (DELETE /api/profile/public). */
export function setPortfolioPublic(isPublic: boolean): Promise<ApiResult<PortfolioStatusResponse>> {
  if (USE_MOCK_API) return mockApi.setPortfolioPublic(isPublic);
  return sendJson<Record<string, never>, PortfolioStatusResponse>(isPublic ? "POST" : "DELETE", "/api/profile/public", {});
}

/** The job seeker's profile (read-only, from their resume), from GET /api/profile. */
export async function getProfile(): Promise<ApiResult<ProfileResponse>> {
  if (USE_MOCK_API) return mockApi.getProfile();
  const result = await getJson("/api/profile");
  return result.ok ? { ok: true, data: toProfileResponse(result.data) } : result;
}

const isPath = (p: unknown): p is LearningPath => !!p && typeof (p as LearningPath).id === "string" && typeof (p as LearningPath).skillName === "string";

/** Market Reach, missing skills and learning paths, from GET /api/learning. */
export async function getLearningInsights(): Promise<ApiResult<LearningInsights>> {
  if (USE_MOCK_API) return mockApi.getLearningInsights();
  const result = await getJson("/api/learning");
  if (!result.ok) return result;
  const b = (result.data ?? {}) as Partial<LearningInsights>;
  return {
    ok: true,
    data: {
      hasResume: b.hasResume === true,
      marketReachPercent: typeof b.marketReachPercent === "number" ? b.marketReachPercent : 0,
      baselinePercent: typeof b.baselinePercent === "number" ? b.baselinePercent : null,
      jobsAnalyzed: typeof b.jobsAnalyzed === "number" ? b.jobsAnalyzed : 0,
      missingSkills: Array.isArray(b.missingSkills) ? b.missingSkills.filter((m) => m && typeof m.skill === "string") : [],
      paths: Array.isArray(b.paths) ? b.paths.filter(isPath) : [],
    },
  };
}

/** Starts learning paths for skills with POST /api/learning/paths and returns all of the user's paths. */
export async function startLearning(skills: string[]): Promise<ApiResult<LearningPath[]>> {
  if (USE_MOCK_API) return mockApi.startLearning(skills);
  const result = await postJson<StartLearningRequest, unknown>("/api/learning/paths", { skills });
  return result.ok ? { ok: true, data: Array.isArray(result.data) ? result.data.filter(isPath) : [] } : result;
}

/** Ticks roadmap steps or changes status with PATCH /api/learning/paths/:id. */
export async function updateLearningPath(id: string, changes: UpdateLearningPathRequest): Promise<ApiResult<LearningPath>> {
  if (USE_MOCK_API) return mockApi.updateLearningPath(id, changes);
  const result = await sendJson<UpdateLearningPathRequest, unknown>("PATCH", `/api/learning/paths/${encodeURIComponent(id)}`, changes);
  if (!result.ok) return result;
  return isPath(result.data) ? { ok: true, data: result.data } : { ok: false, error: toApiError(null, 500) };
}

/** Stops following a learning path with DELETE /api/learning/paths/:id. */
export async function removeLearningPath(id: string): Promise<ApiResult<null>> {
  if (USE_MOCK_API) return mockApi.removeLearningPath(id);
  let res: Response;
  try {
    res = await fetch(`/api/learning/paths/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  if (res.ok) return { ok: true, data: null };
  return { ok: false, error: toApiError(await res.json().catch(() => null), res.status) };
}

/** Everything the sidebar's deadline tracker shows, from GET /api/deadlines. */
export async function listDeadlines(): Promise<ApiResult<DeadlineItem[]>> {
  if (USE_MOCK_API) return mockApi.listDeadlines();
  const result = await getJson("/api/deadlines");
  return result.ok ? { ok: true, data: toDeadlineList(result.data) } : result;
}

/** Adds one of the user's own deadlines with POST /api/deadlines. */
export async function createDeadline(request: CreateDeadlineRequest): Promise<ApiResult<DeadlineItem>> {
  if (USE_MOCK_API) return mockApi.createDeadline(request);
  const result = await postJson<CreateDeadlineRequest, unknown>("/api/deadlines", request);
  if (!result.ok) return result;
  const data = toDeadlineItem(result.data);
  return data ? { ok: true, data } : { ok: false, error: toApiError(null, 500) };
}

/** Ticks one of the user's own deadlines off (or back on). Takes the tracker item id ("custom:<id>"). */
export async function updateDeadline(itemId: string, done: boolean): Promise<ApiResult<DeadlineItem>> {
  if (USE_MOCK_API) return mockApi.updateDeadline(itemId, done);
  const id = customDeadlineId(itemId) ?? itemId;
  const result = await sendJson<{ done: boolean }, unknown>("PATCH", `/api/deadlines/${encodeURIComponent(id)}`, { done });
  if (!result.ok) return result;
  const data = toDeadlineItem(result.data);
  return data ? { ok: true, data } : { ok: false, error: toApiError(null, 500) };
}

/** Removes one of the user's own deadlines. Takes the tracker item id ("custom:<id>"). */
export async function deleteDeadline(itemId: string): Promise<ApiResult<null>> {
  if (USE_MOCK_API) return mockApi.deleteDeadline(itemId);
  const id = customDeadlineId(itemId) ?? itemId;
  let res: Response;
  try {
    res = await fetch(`/api/deadlines/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  if (res.ok) return { ok: true, data: null };
  return { ok: false, error: toApiError(await res.json().catch(() => null), res.status) };
}

/** The user's Spreadsheet rows, newest first, from GET /api/submissions. */
export async function listSubmissions(): Promise<ApiResult<Submission[]>> {
  if (USE_MOCK_API) return mockApi.listSubmissions();
  const result = await getJson("/api/submissions");
  return result.ok ? { ok: true, data: toSubmissionList(result.data) } : result;
}

/**
 * Records an application with POST /api/submissions. With a jobId the row is prefilled from the job
 * and the user's resume; applying to the same job again returns the existing row (created: false).
 */
export async function createSubmission(request: CreateSubmissionRequest): Promise<ApiResult<CreateSubmissionResponse>> {
  if (USE_MOCK_API) return mockApi.createSubmission(request);
  const result = await postJson<CreateSubmissionRequest, unknown>("/api/submissions", request);
  if (!result.ok) return result;
  const data = toCreateSubmissionResponse(result.data);
  return data ? { ok: true, data } : { ok: false, error: toApiError(null, 500) };
}

/** Changes cells with PATCH /api/submissions/:id ("" clears a cell) and returns the stored row. */
export async function updateSubmission(id: string, changes: UpdateSubmissionRequest): Promise<ApiResult<Submission>> {
  if (USE_MOCK_API) return mockApi.updateSubmission(id, changes);
  const result = await sendJson<UpdateSubmissionRequest, unknown>("PATCH", `/api/submissions/${encodeURIComponent(id)}`, changes);
  if (!result.ok) return result;
  const data = toSubmission(result.data);
  return data ? { ok: true, data } : { ok: false, error: toApiError(null, 500) };
}

/* ---------- Connections and chat ---------- */

/** Fired after anything that changes the menu's chat or inbox numbers, so the sidebar refreshes at once. */
export const CHAT_CHANGED_EVENT = "job-assistant:chat-changed";
const chatChanged = () => window.dispatchEvent(new Event(CHAT_CHANGED_EVENT));

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Unread messages and the account's connection counts, from GET /api/chat/summary. */
export async function getChatSummary(): Promise<ApiResult<ChatSummary>> {
  if (USE_MOCK_API) return mockApi.getChatSummary();
  const result = await getJson("/api/chat/summary");
  return result.ok ? { ok: true, data: result.data as ChatSummary } : result;
}

/** The people you're connected to and the people connected to you, from GET /api/connections. */
export async function listConnections(): Promise<ApiResult<ConnectionsResponse>> {
  if (USE_MOCK_API) return mockApi.listConnections();
  const result = await getJson("/api/connections");
  if (!result.ok) return result;
  const body = (result.data ?? {}) as Partial<ConnectionsResponse>;
  return { ok: true, data: { connectedTo: asArray<Person>(body.connectedTo), connectedToMe: asArray<Person>(body.connectedToMe) } };
}

/** Finds people by name (2+ characters) or exact email, from GET /api/people. */
export async function searchPeople(q: string): Promise<ApiResult<Person[]>> {
  if (USE_MOCK_API) return mockApi.searchPeople(q);
  const result = await getJson(`/api/people?q=${encodeURIComponent(q)}`);
  return result.ok ? { ok: true, data: asArray<Person>((result.data as { people?: unknown } | null)?.people) } : result;
}

/** Connects you to someone, or changes what they are to you, with POST /api/connections. */
export async function connectTo(request: ConnectRequest): Promise<ApiResult<Person>> {
  const result = USE_MOCK_API ? await mockApi.connectTo(request) : await postJson<ConnectRequest, Person>("/api/connections", request);
  if (result.ok) chatChanged();
  return result;
}

/** Removes your connection to someone with DELETE /api/connections/:userId. */
export async function disconnectFrom(userId: string): Promise<ApiResult<null>> {
  if (USE_MOCK_API) {
    const result = await mockApi.disconnectFrom(userId);
    chatChanged();
    return result;
  }
  let res: Response;
  try {
    res = await fetch(`/api/connections/${encodeURIComponent(userId)}`, { method: "DELETE", credentials: "same-origin" });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  if (!res.ok) return { ok: false, error: toApiError(await res.json().catch(() => null), res.status) };
  chatChanged();
  return { ok: true, data: null };
}

/** Your chats, most recent first, from GET /api/chat. */
export async function listChats(): Promise<ApiResult<ChatConversation[]>> {
  if (USE_MOCK_API) return mockApi.listChats();
  const result = await getJson("/api/chat");
  return result.ok ? { ok: true, data: asArray<ChatConversation>((result.data as { conversations?: unknown } | null)?.conversations) } : result;
}

/** Opens (or starts) your chat with someone and returns its id, with POST /api/chat. */
export async function openChat(userId: string): Promise<ApiResult<{ id: string }>> {
  if (USE_MOCK_API) return mockApi.openChat(userId);
  return postJson<{ userId: string }, { id: string }>("/api/chat", { userId });
}

/** A chat's messages from GET /api/chat/:id (only those after `after`, when given). Marks the chat read. */
export async function getChat(id: string, after?: string): Promise<ApiResult<ChatThreadResponse>> {
  if (USE_MOCK_API) return mockApi.getChat(id, after);
  const result = await getJson(`/api/chat/${encodeURIComponent(id)}${after ? `?after=${encodeURIComponent(after)}` : ""}`);
  if (!result.ok) return result;
  const body = result.data as ChatThreadResponse;
  return { ok: true, data: { ...body, messages: asArray<ChatMessage>(body?.messages) } };
}

/** Sends a message with POST /api/chat/:id. */
export async function sendChatMessage(id: string, body: string): Promise<ApiResult<ChatMessage>> {
  if (USE_MOCK_API) return mockApi.sendChatMessage(id, body);
  return postJson<{ body: string }, ChatMessage>(`/api/chat/${encodeURIComponent(id)}`, { body });
}

/* ---------- Inbox (project email) ---------- */

/** Your project address and your emails, newest first, from GET /api/email. */
export async function listEmails(): Promise<ApiResult<EmailListResponse>> {
  if (USE_MOCK_API) return mockApi.listEmails();
  const result = await getJson("/api/email");
  if (!result.ok) return result;
  const body = (result.data ?? {}) as Partial<EmailListResponse>;
  return {
    ok: true,
    data: {
      address: typeof body.address === "string" ? body.address : null,
      canReceive: body.canReceive === true,
      canSend: body.canSend === true,
      emails: asArray<EmailSummary>(body.emails).filter((e) => !!e && typeof e.id === "string"),
    },
  };
}

/** One email in full from GET /api/email/:id. Marks it read, so the menu's number is refreshed. */
export async function getEmail(id: string): Promise<ApiResult<EmailDetail>> {
  const result = USE_MOCK_API ? await mockApi.getEmail(id) : await getJson(`/api/email/${encodeURIComponent(id)}`);
  if (!result.ok) return result;
  chatChanged();
  const body = result.data as EmailDetail;
  return { ok: true, data: { ...body, attachments: asArray<string>(body?.attachments) } };
}

/** Sends an email from your project address with POST /api/email. */
export async function sendEmail(request: SendEmailRequest): Promise<ApiResult<EmailDetail>> {
  if (USE_MOCK_API) return mockApi.sendEmail(request);
  return postJson<SendEmailRequest, EmailDetail>("/api/email", request);
}

/** Deletes one of your emails with DELETE /api/email/:id. */
export async function deleteEmail(id: string): Promise<ApiResult<null>> {
  if (USE_MOCK_API) {
    const result = await mockApi.deleteEmail(id);
    chatChanged();
    return result;
  }
  let res: Response;
  try {
    res = await fetch(`/api/email/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  if (!res.ok) return { ok: false, error: toApiError(await res.json().catch(() => null), res.status) };
  chatChanged();
  return { ok: true, data: null };
}

/** The saved mock call preparation for a submission, from GET /api/submissions/:id/prep. */
export async function getMockCallPrep(id: string): Promise<ApiResult<MockCallPrepResponse>> {
  if (USE_MOCK_API) return mockApi.getMockCallPrep(id);
  const result = await getJson(`/api/submissions/${encodeURIComponent(id)}/prep`);
  return result.ok ? { ok: true, data: result.data as MockCallPrepResponse } : result;
}

/** Writes (or rewrites) the 50 questions and answers with POST /api/submissions/:id/prep. Takes a few minutes. */
export function writeMockCallPrep(id: string, request: WriteMockCallPrepRequest = {}): Promise<ApiResult<MockCallPrepResponse>> {
  if (USE_MOCK_API) return mockApi.writeMockCallPrep(id, request);
  return sendJson<WriteMockCallPrepRequest, MockCallPrepResponse>("POST", `/api/submissions/${encodeURIComponent(id)}/prep`, request);
}

/** Removes a row from every sheet with DELETE /api/submissions/:id. */
export async function deleteSubmission(id: string): Promise<ApiResult<null>> {
  if (USE_MOCK_API) return mockApi.deleteSubmission(id);
  let res: Response;
  try {
    res = await fetch(`/api/submissions/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  if (res.ok) return { ok: true, data: null };
  return { ok: false, error: toApiError(await res.json().catch(() => null), res.status) };
}

/** The Spreadsheet as an .xlsx file (one worksheet per sheet), from GET /api/submissions/export. */
export async function exportSubmissions(): Promise<ApiResult<Blob>> {
  if (USE_MOCK_API) return mockApi.exportSubmissions();
  let res: Response;
  try {
    res = await fetch("/api/submissions/export", { credentials: "same-origin", cache: "no-store" });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  if (res.ok) return { ok: true, data: await res.blob() };
  return { ok: false, error: toApiError(await res.json().catch(() => null), res.status) };
}

export function register(payload: RegisterRequest): Promise<ApiResult<AuthResponse>> {
  if (USE_MOCK_API) return mockApi.register(payload);
  return postJson<RegisterRequest, AuthResponse>("/api/auth/register", payload);
}

export function login(payload: LoginRequest): Promise<ApiResult<AuthResponse>> {
  if (USE_MOCK_API) return mockApi.login(payload);
  return postJson<LoginRequest, AuthResponse>("/api/auth/login", payload);
}

export async function logout(): Promise<void> {
  clearUser();
  if (USE_MOCK_API) return mockApi.logout();
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(
    () => undefined,
  );
}

/**
 * Saves the edited resume with PUT /api/resumes/:id and returns the stored version.
 * Validation problems come back as ApiError.fieldErrors keyed by field path,
 * e.g. "workExperience.0.startDate".
 */
export function saveResume(resume: Resume): Promise<ApiResult<Resume>> {
  if (USE_MOCK_API) return mockApi.saveResume(resume);
  return sendJson<Resume, Resume>("PUT", `/api/resumes/${encodeURIComponent(resume.id)}`, resume);
}

/**
 * Appends skills to a resume with PATCH /api/resumes/:id and returns the stored version.
 * Skills the resume already has are skipped. Run analyzeGap again for the updated score,
 * or use withAddedSkills from lib/skills to preview it first.
 */
export function addSkills(resumeId: string, newSkills: string[]): Promise<ApiResult<Resume>> {
  if (USE_MOCK_API) return mockApi.addSkills(resumeId, newSkills);
  return sendJson<AddSkillsRequest, Resume>("PATCH", `/api/resumes/${encodeURIComponent(resumeId)}`, { newSkills });
}

/**
 * Asks POST /api/summary-generate for three summary options (leadership, technical depth,
 * industry fit, in that order). Nothing is saved until saveSummary is called.
 */
export function generateSummaries(request: SummaryGenerateRequest): Promise<ApiResult<SummaryGenerateResponse>> {
  if (USE_MOCK_API) return mockApi.generateSummaries(request);
  return postJson<SummaryGenerateRequest, SummaryGenerateResponse>("/api/summary-generate", request);
}

/** Replaces the resume's summary with PATCH /api/resumes/:id/summary and returns the stored version. */
export function saveSummary(resumeId: string, newSummary: string): Promise<ApiResult<Resume>> {
  if (USE_MOCK_API) return mockApi.saveSummary(resumeId, newSummary);
  return sendJson<UpdateSummaryRequest, Resume>("PATCH", `/api/resumes/${encodeURIComponent(resumeId)}/summary`, {
    newSummary,
  });
}

/**
 * Compares a resume with a pasted job description using POST /api/gap-analysis.
 * Suggested bullets only reword the user's existing bullets.
 */
export function analyzeGap(request: GapAnalysisRequest): Promise<ApiResult<GapAnalysisResponse>> {
  if (USE_MOCK_API) return mockApi.analyzeGap(request);
  return postJson<GapAnalysisRequest, GapAnalysisResponse>("/api/gap-analysis", request);
}

/**
 * Builds the tailored resume from the accepted bullets and renders the requested
 * files with POST /api/tailor. Each returned file has its own downloadUrl.
 */
export function tailorResume(request: TailoredResumeRequest): Promise<ApiResult<TailoredResumeResponse>> {
  if (USE_MOCK_API) return mockApi.tailorResume(request);
  return postJson<TailoredResumeRequest, TailoredResumeResponse>("/api/tailor", request);
}

/**
 * Uploads a resume as multipart/form-data (field name "file").
 * Uses XMLHttpRequest instead of fetch so we can report upload progress.
 */
/**
 * Step 1 of uploading a resume: POST /api/resume/compare reads the file and lists how it would
 * change the profile. Nothing is saved until confirmResumeSync.
 */
export async function compareResume(file: File, onProgress?: (percent: number) => void): Promise<ApiResult<ResumeCompareResponse>> {
  if (USE_MOCK_API) return mockApi.compareResume(file, onProgress);
  const form = new FormData();
  form.append("file", file);
  const result = await sendForm<ResumeCompareResponse>("/api/resume/compare", form, onProgress);
  if (!result.ok) return result;
  const d = result.data;
  return d && d.draft?.contact && Array.isArray(d.changes) && typeof d.requiresConfirmation === "boolean" && typeof d.syncToken === "string"
    ? result
    : { ok: false, error: toApiError(null, 500) };
}

/** Step 2: POST /api/resume/confirm-sync saves the compared resume and updates the profile to match. */
export async function confirmResumeSync(file: File, compared: ResumeCompareResponse): Promise<ApiResult<ResumeSyncResponse>> {
  if (USE_MOCK_API) return mockApi.confirmResumeSync(file, compared);
  const form = new FormData();
  form.append("file", file);
  form.append("draft", JSON.stringify(compared.draft));
  form.append("syncToken", compared.syncToken);
  const result = await sendForm<ResumeSyncResponse>("/api/resume/confirm-sync", form);
  if (!result.ok) return result;
  return result.data?.resume?.contact ? result : { ok: false, error: toApiError(null, 500) };
}

/**
 * Posts multipart/form-data. Uses XMLHttpRequest instead of fetch so we can report upload
 * progress; the server keeps working after 100%, which the UI shows as a separate step.
 */
function sendForm<T>(url: string, form: FormData, onProgress?: (percent: number) => void): Promise<ApiResult<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    // Some browsers skip the final progress event, so mark the upload done explicitly.
    xhr.upload.onload = () => onProgress?.(100);

    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON body; handled below
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, data: body as T });
      } else {
        resolve({ ok: false, error: toApiError(body, xhr.status) });
      }
    };

    xhr.onerror = () => resolve({ ok: false, error: NETWORK_ERROR });
    xhr.send(form);
  });
}
