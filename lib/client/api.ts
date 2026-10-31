import type {
  AddSkillsRequest,
  ApiError,
  AuthResponse,
  GapAnalysisRequest,
  CreateJobPostingRequest,
  GapAnalysisResponse,
  JobPosting,
  LoginRequest,
  RegisterRequest,
  Resume,
  SummaryGenerateRequest,
  SummaryGenerateResponse,
  TailoredResumeRequest,
  TailoredResumeResponse,
  UpdateSummaryRequest,
} from "@/lib/types";
import { clearUser } from "./current-user";
import { toJobList } from "./jobs";
import { mockApi } from "./mock";

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
  method: "POST" | "PUT" | "PATCH",
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
export function uploadResume(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ApiResult<Resume>> {
  if (USE_MOCK_API) return mockApi.uploadResume(file, onProgress);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    // Some browsers skip the final progress event, so mark the upload done explicitly.
    // The server keeps parsing after this, which the UI shows as a separate step.
    xhr.upload.onload = () => onProgress?.(100);

    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON body; handled below
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, data: body as Resume });
      } else {
        resolve({ ok: false, error: toApiError(body, xhr.status) });
      }
    };

    xhr.onerror = () => resolve({ ok: false, error: NETWORK_ERROR });

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
