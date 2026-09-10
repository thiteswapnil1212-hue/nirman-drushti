/**
 * Central API client for Nirman Drushti.
 *
 * All backend communication should go through this module.
 * This keeps API implementation details away from UI components
 * and makes the frontend easier to migrate from demo data to
 * the FastAPI/ML backend.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://nirman-drushti-api.onrender.com";

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

export type AnalyticsNumber = string | number | null;

export interface ApiAnalyticsMetric {
  value: AnalyticsNumber;
  classification: "reported" | "derived" | "unavailable";
  available: boolean;
  reason: string | null;
}

export interface ApiAnalyticsNotice {
  availability: "available" | "insufficient_observations" | "unavailable";
  reason: string | null;
}

export interface ApiPortfolioSummary {
  project_count: number;
  projects_with_cost: number;
  projects_with_progress: number;
  reported_original_cost: ApiAnalyticsMetric;
  reported_current_cost: ApiAnalyticsMetric;
  reported_expenditure: ApiAnalyticsMetric;
  reported_average_progress: ApiAnalyticsMetric;
  derived_cost_escalation_amount: ApiAnalyticsMetric;
  derived_cost_escalation_percentage: ApiAnalyticsMetric;
  derived_expenditure_percentage: ApiAnalyticsMetric;
  derived_schedule_extensions: ApiAnalyticsMetric;
  risk_status: ApiAnalyticsNotice;
}

export interface ApiCostGroup {
  group: string;
  project_count: number;
  reported_original_cost: AnalyticsNumber;
  reported_current_cost: AnalyticsNumber;
  reported_expenditure: AnalyticsNumber;
  derived_escalation_amount: AnalyticsNumber;
  derived_escalation_percentage: AnalyticsNumber;
}

export interface ApiCostAnalytics {
  group_by: string;
  groups: ApiCostGroup[];
  notice: ApiAnalyticsNotice;
}

export interface ApiTrendPoint {
  reporting_period: string;
  reported_current_cost: AnalyticsNumber;
  reported_expenditure: AnalyticsNumber;
  reported_physical_progress: AnalyticsNumber;
  observation_count: number;
}

export interface ApiHeatmapCell {
  group: string;
  reporting_period: string;
  observation_count: number;
  average_progress: AnalyticsNumber;
}

export interface ApiTrendAnalytics {
  points: ApiTrendPoint[];
  heatmap: ApiHeatmapCell[];
  notice: ApiAnalyticsNotice;
}

export interface ApiCompositionItem {
  label: string;
  count: number;
  percentage: AnalyticsNumber;
}

export interface ApiCompositionAnalytics {
  category: string;
  items: ApiCompositionItem[];
  notice: ApiAnalyticsNotice;
}

export interface ApiHistogramBin {
  lower: string | number;
  upper: string | number;
  count: number;
}

export interface ApiScatterPoint {
  project_id: string;
  project_name: string;
  physical_progress: AnalyticsNumber;
  expenditure_percentage: AnalyticsNumber;
  escalation_percentage: AnalyticsNumber;
}

export interface ApiBoxPlotGroup {
  group: string;
  count: number;
  minimum: AnalyticsNumber;
  lower_quartile: AnalyticsNumber;
  median: AnalyticsNumber;
  upper_quartile: AnalyticsNumber;
  maximum: AnalyticsNumber;
}

export interface ApiDistributionAnalytics {
  escalation_histogram: ApiHistogramBin[];
  progress_histogram: ApiHistogramBin[];
  scatter: ApiScatterPoint[];
  box_plot: ApiBoxPlotGroup[];
  notice: ApiAnalyticsNotice;
}

export interface ApiBenchmarkRow {
  rank: number;
  group: string;
  project_count: number;
  average_progress: AnalyticsNumber;
  average_expenditure_percentage: AnalyticsNumber;
  average_escalation_percentage: AnalyticsNumber;
}

export interface ApiBenchmarkingAnalytics {
  group_by: string;
  rows: ApiBenchmarkRow[];
  notice: ApiAnalyticsNotice;
}

export interface ApiPortfolioAnalytics {
  summary: ApiPortfolioSummary;
  cost: ApiCostAnalytics;
  trends: ApiTrendAnalytics;
  composition: ApiCompositionAnalytics;
  distributions: ApiDistributionAnalytics;
  benchmarking: ApiBenchmarkingAnalytics;
}

export interface ApiMLEvaluationResult {
  task: "cost_revision" | "schedule_revision";
  approach: "conventional" | "ml";
  sample_count: number;
  positive_rate: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number | null;
  pr_auc: number | null;
  confusion_matrix: number[][];
}

export interface ApiMLEvaluation {
  availability: "AVAILABLE" | "INSUFFICIENT_DATA";
  cost_comparison: ApiMLEvaluationResult[];
  schedule_comparison: ApiMLEvaluationResult[];
  conclusion: Record<string, string>;
  evaluation_version: string;
  evaluation_timestamp: string;
  limitations: string[];
}

export interface PortfolioAnalyticsParams {
  reporting_period?: string;
  state?: string;
  ministry?: string;
  sector?: string;
  implementing_agency?: string;
  group_by?: "state" | "ministry" | "sector" | "implementing_agency";
  category?: "state" | "ministry" | "sector" | "implementing_agency" | "status";
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

export function getPortfolioAnalytics(
  params: PortfolioAnalyticsParams = {},
  options?: RequestInit,
): Promise<ApiPortfolioAnalytics> {
  const query = new URLSearchParams();
  appendQueryParam(query, "reporting_period", params.reporting_period);
  appendQueryParam(query, "state", params.state);
  appendQueryParam(query, "ministry", params.ministry);
  appendQueryParam(query, "sector", params.sector);
  appendQueryParam(query, "implementing_agency", params.implementing_agency);
  appendQueryParam(query, "group_by", params.group_by);
  appendQueryParam(query, "category", params.category);
  const suffix = query.toString();
  return apiRequest<ApiPortfolioAnalytics>(
    `/api/v1/analytics${suffix ? `?${suffix}` : ""}`,
    { ...PROJECT_FETCH_OPTIONS, ...options },
  );
}

export function getMLEvaluation(options?: RequestInit): Promise<ApiMLEvaluation> {
  return apiRequest<ApiMLEvaluation>("/api/v1/ml-evaluation", { ...PROJECT_FETCH_OPTIONS, ...options });
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
  escalation_amount: string | number | null;
  cumulative_expenditure: string | number | null;
  expenditure_percentage: string | number | null;
  historical_observations: ApiCostHistory[];
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

export interface ApiCostPredictionSignal {
  feature: string;
  value: string;
  contribution: string | number;
}

export interface ApiCostPredictionExplanation {
  positive_signals: ApiCostPredictionSignal[];
  negative_signals: ApiCostPredictionSignal[];
  model_note: string;
}

export interface ApiCostRevisionPrediction {
  project_id: string;
  availability: "AVAILABLE" | "INSUFFICIENT_DATA" | "UNAVAILABLE";
  prediction: boolean | null;
  probability: string | number | null;
  confidence_label: string | null;
  model_version: string;
  cutoff_reporting_period: string | null;
  feature_coverage: string | number;
  features_used: string[];
  limitations: string[];
  explanation: ApiCostPredictionExplanation | null;
}

export interface ApiCostIntelligenceResponse {
  project_id: string;
  availability: "AVAILABLE" | "INSUFFICIENT_DATA" | "UNAVAILABLE";
  original_cost: string | number | null;
  revised_current_cost: string | number | null;
  expenditure: string | number | null;
  current_cost_overrun_amount: string | number | null;
  current_cost_overrun_percentage: string | number | null;
  escalation_amount: string | number | null;
  escalation_percentage: string | number | null;
  expenditure_percentage: string | number | null;
  amount_above_revised_cost: string | number | null;
  expenditure_exceeds_revised_cost: boolean | null;
  completion_cost_availability: "AVAILABLE" | "UNAVAILABLE";
  completion_cost_overrun_amount: string | number | null;
  completion_cost_overrun_percentage: string | number | null;
  prediction: ApiCostRevisionPrediction;
  limitations: string[];
}

export interface ApiScheduleRevisionPrediction {
  project_id: string;
  availability: "AVAILABLE" | "INSUFFICIENT_DATA" | "UNAVAILABLE";
  prediction: boolean | null;
  probability: string | number | null;
  model_version: string;
  cutoff_reporting_period: string | null;
  feature_coverage: string | number;
  limitations: string[];
}

export type ApiRiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "UNAVAILABLE";
export type ApiRiskSeverity = ApiRiskLevel;
export type ApiAssessmentAvailability = "AVAILABLE" | "INSUFFICIENT_DATA" | "UNAVAILABLE";

export interface ApiRiskFactor {
  factor: string;
  value: string | number | null;
  unit: string | null;
  contribution: number | null;
  severity: ApiRiskSeverity;
  classification: "REPORTED" | "DERIVED" | "UNAVAILABLE";
  available: boolean;
  explanation: string;
}

export interface ApiRiskAssessment {
  project_id: string;
  score: number | null;
  level: ApiRiskLevel;
  availability: ApiAssessmentAvailability;
  data_coverage: string | number;
  confidence_label: string;
  factors: ApiRiskFactor[];
  explanation: string;
  limitations: string[];
  predicted: boolean;
}

export interface ApiRiskPortfolioItem {
  project_id: string;
  project_name: string;
  score: number | null;
  level: ApiRiskLevel;
  data_coverage: string | number;
  cost_pressure: number | null;
  schedule_pressure: number | null;
  progress_pressure: number | null;
}

export interface ApiRiskSummary {
  projects_assessed: number;
  projects_unavailable: number;
  low_projects: number;
  moderate_projects: number;
  high_projects: number;
  critical_projects: number;
  average_score: string | number | null;
  average_data_coverage: string | number | null;
  top_projects: ApiRiskPortfolioItem[];
  limitations: string[];
}

export interface ApiRiskSummaryResponse {
  availability: ApiAssessmentAvailability;
  summary: ApiRiskSummary;
}

export type ApiWarningType = "COST_ESCALATION" | "SCHEDULE_EXTENSION" | "EXPENDITURE_PROGRESS_DIVERGENCE" | "PROGRESS_SLOWDOWN" | "DATA_QUALITY";
export type ApiWarningSeverity = "INFO" | "MODERATE" | "HIGH" | "CRITICAL";

export interface ApiEarlyWarning {
  warning_id: string;
  project_id: string;
  project_name: string;
  type: ApiWarningType;
  severity: ApiWarningSeverity;
  title: string;
  message: string;
  evidence: { values: Record<string, string | number | boolean | null> };
  recommended_action: string;
  source_type: "REPORTED" | "DERIVED" | "DATA_QUALITY";
  generated_at: string;
}

export interface ApiWarningList {
  summary: { critical: number; high: number; moderate: number; info: number; total: number };
  items: ApiEarlyWarning[];
  limitations: string[];
  page: number;
  page_size: number;
}

export interface RiskFilterParams {
  state?: string;
  ministry?: string;
  sector?: string;
  implementing_agency?: string;
}

export interface WarningFilterParams extends RiskFilterParams {
  severity?: ApiWarningSeverity;
  warning_type?: ApiWarningType;
  page?: number;
  page_size?: number;
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

/** Loads reported/derived cost intelligence and the existing cost revision prediction. */
export function getCostIntelligence(
  projectId: string,
  options?: RequestInit,
): Promise<ApiCostIntelligenceResponse> {
  return apiRequest<ApiCostIntelligenceResponse>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/cost-intelligence`,
    { ...PROJECT_FETCH_OPTIONS, ...options },
  );
}

function filterQuery(params: RiskFilterParams): string {
  const query = new URLSearchParams();
  appendQueryParam(query, "state", params.state);
  appendQueryParam(query, "ministry", params.ministry);
  appendQueryParam(query, "sector", params.sector);
  appendQueryParam(query, "implementing_agency", params.implementing_agency);
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export function getProjectRisk(projectId: string, options?: RequestInit): Promise<ApiRiskAssessment> {
  return apiRequest<ApiRiskAssessment>(`/api/v1/projects/${encodeURIComponent(projectId)}/risk`, { ...PROJECT_FETCH_OPTIONS, ...options });
}

export function getProjectWarnings(projectId: string, options?: RequestInit): Promise<ApiEarlyWarning[]> {
  return apiRequest<ApiEarlyWarning[]>(`/api/v1/projects/${encodeURIComponent(projectId)}/warnings`, { ...PROJECT_FETCH_OPTIONS, ...options });
}

export function getCostRevisionPrediction(projectId: string, options?: RequestInit): Promise<ApiCostRevisionPrediction> {
  return apiRequest<ApiCostRevisionPrediction>(`/api/v1/projects/${encodeURIComponent(projectId)}/prediction/cost`, { ...PROJECT_FETCH_OPTIONS, ...options });
}

export function getScheduleRevisionPrediction(projectId: string, options?: RequestInit): Promise<ApiScheduleRevisionPrediction> {
  return apiRequest<ApiScheduleRevisionPrediction>(`/api/v1/projects/${encodeURIComponent(projectId)}/prediction/schedule`, { ...PROJECT_FETCH_OPTIONS, ...options });
}

export interface ApiProjectAction {
  action_id: string;
  priority: "CRITICAL" | "HIGH" | "MODERATE" | "INFO";
  title: string;
  reason: string;
  evidence: string;
  recommended_check: string;
  source: string;
}

export interface ApiProjectActionsResponse {
  project_id: string;
  actions: ApiProjectAction[];
  action_count: number;
}

export interface ApiProjectAssistantResponse {
  project_id: string;
  answer: string;
  key_points: string[];
  evidence_used: string[];
  data_limitations: string[];
  model: string;
  grounded: boolean;
  status:
    | "success"
    | "provider_unavailable"
    | "provider_quota_exhausted"
    | "provider_configuration_error"
    | "invalid_provider_response"
    | "project_data_unavailable";
}

export function askProjectAssistant(
  projectId: string,
  question: string,
  options?: RequestInit,
): Promise<ApiProjectAssistantResponse> {
  return apiRequest<ApiProjectAssistantResponse>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/assistant`,
    {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
      body: JSON.stringify({ question }),
    },
  );
}

export function getProjectActions(projectId: string, options?: RequestInit): Promise<ApiProjectActionsResponse> {
  return apiRequest<ApiProjectActionsResponse>(`/api/v1/projects/${encodeURIComponent(projectId)}/actions`, { ...PROJECT_FETCH_OPTIONS, ...options });
}

export function getRiskSummary(params: RiskFilterParams = {}, options?: RequestInit): Promise<ApiRiskSummaryResponse> {
  return apiRequest<ApiRiskSummaryResponse>(`/api/v1/risk/summary${filterQuery(params)}`, { ...PROJECT_FETCH_OPTIONS, ...options });
}

export function listWarnings(params: WarningFilterParams = {}, options?: RequestInit): Promise<ApiWarningList> {
  const query = new URLSearchParams(filterQuery(params).replace(/^\?/, ""));
  appendQueryParam(query, "severity", params.severity);
  appendQueryParam(query, "warning_type", params.warning_type);
  appendQueryParam(query, "page", params.page);
  appendQueryParam(query, "page_size", params.page_size);
  const suffix = query.toString();
  return apiRequest<ApiWarningList>(`/api/v1/warnings${suffix ? `?${suffix}` : ""}`, { ...PROJECT_FETCH_OPTIONS, ...options });
}
