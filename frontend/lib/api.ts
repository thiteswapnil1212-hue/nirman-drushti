/**
 * Central API client for Nirman Drushti.
 *
 * All backend communication should go through this module.
 * This keeps API implementation details away from UI components
 * and makes the frontend easier to migrate from demo data to
 * the FastAPI/ML backend.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Performs a typed HTTP request against the backend API.
 *
 * @param endpoint - API endpoint beginning with "/"
 * @param options - Optional fetch configuration
 * @returns Parsed JSON response
 * @throws Error when the backend returns a non-success status
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status);
  }

  return response.json() as Promise<T>;
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`API request failed with status ${status}.`);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export type ApiProjectStatus = "ON_TRACK" | "WATCH" | "HIGH_RISK";

export interface ApiProject {
  id: string;
  project_code: string | null;
  legacy_ocms_code: string | null;
  pmgid: string | null;
  name: string | null;
  ministry: string | null;
  department: string | null;
  sector: string | null;
  location: string | null;
  state: string | null;
  implementing_agency: string | null;
  status: ApiProjectStatus | null;
  original_cost: string | number | null;
  current_cost: string | number | null;
  expenditure: string | number | null;
  physical_progress: string | number | null;
  expected_progress: string | number | null;
  project_identity: string | null;
  planned_start_date: string | null;
  planned_completion_date: string | null;
  expected_completion_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiProjectPage {
  items: ApiProject[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListProjectsParams {
  page?: number;
  page_size?: number;
  search?: string;
  state?: string;
  implementing_agency?: string;
  status?: ApiProjectStatus;
}

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
) {
  if (value === undefined) {
    return;
  }

  const normalized = typeof value === "number" ? String(value) : value.trim();
  if (normalized.length === 0) {
    return;
  }

  params.set(key, normalized);
}

/**
 * Loads a paginated project register from GET /api/v1/projects.
 */
export function listProjects(
  params: ListProjectsParams = {},
  options?: RequestInit,
): Promise<ApiProjectPage> {
  const query = new URLSearchParams();
  appendQueryParam(query, "page", params.page ?? 1);
  appendQueryParam(query, "page_size", params.page_size ?? 20);
  appendQueryParam(query, "search", params.search);
  appendQueryParam(query, "state", params.state);
  appendQueryParam(query, "implementing_agency", params.implementing_agency);
  appendQueryParam(query, "status", params.status);

  const suffix = query.toString();
  return apiRequest<ApiProjectPage>(
    `/api/v1/projects${suffix ? `?${suffix}` : ""}`,
    options,
  );
}

export interface ApiProgressHistory {
  id: string;
  project_id: string;
  reporting_period: string;
  physical_progress: string | number | null;
  expected_progress: string | number | null;
  expenditure: string | number | null;
  status: ApiProjectStatus | null;
  project_identity: string | null;
  source_filename: string | null;
  notes: string | null;
  created_at: string;
}

export interface ApiCostHistory {
  id: string;
  project_id: string;
  recorded_at: string;
  original_cost: string | number | null;
  current_cost: string | number | null;
  expenditure: string | number | null;
  project_identity: string | null;
  source_filename: string | null;
  created_at: string;
}

export interface ApiProjectHistory {
  progress: ApiProgressHistory[];
  costs: ApiCostHistory[];
}

export interface ApiCostIntelligence {
  original_cost: string | number | null;
  latest_cost: string | number | null;
  absolute_increase: string | number | null;
  escalation_percentage: string | number | null;
  expenditure: string | number | null;
}

export interface ApiProgressIntelligence {
  latest_progress: string | number | null;
  previous_progress: string | number | null;
  progress_change: string | number | null;
  trend: string | null;
  observation_count: number;
}

export interface ApiScheduleIntelligence {
  planned_completion: string | null;
  expected_completion: string | null;
  extension_days: number | null;
  extension_months: number | null;
  has_extension: boolean | null;
}

export interface ApiDataQuality {
  sufficient_history: boolean;
  available_fields: string[];
}

export interface ApiProjectIntelligence {
  cost: ApiCostIntelligence;
  progress: ApiProgressIntelligence;
  schedule: ApiScheduleIntelligence;
  data_quality: ApiDataQuality;
}

const PROJECT_FETCH_OPTIONS: RequestInit = {
  cache: "no-store",
};

/**
 * Loads one project from GET /api/v1/projects/{project_id}.
 */
export function getProject(
  projectId: string,
  options?: RequestInit,
): Promise<ApiProject> {
  return apiRequest<ApiProject>(
    `/api/v1/projects/${encodeURIComponent(projectId)}`,
    { ...PROJECT_FETCH_OPTIONS, ...options },
  );
}

/**
 * Loads progress and cost history from GET /api/v1/projects/{project_id}/history.
 */
export function getProjectHistory(
  projectId: string,
  options?: RequestInit,
): Promise<ApiProjectHistory> {
  return apiRequest<ApiProjectHistory>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/history`,
    { ...PROJECT_FETCH_OPTIONS, ...options },
  );
}

/**
 * Loads project intelligence metrics from GET /api/v1/projects/{project_id}/intelligence.
 */
export function getProjectIntelligence(
  projectId: string,
  options?: RequestInit,
): Promise<ApiProjectIntelligence> {
  return apiRequest<ApiProjectIntelligence>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence`,
    { ...PROJECT_FETCH_OPTIONS, ...options },
  );
}
