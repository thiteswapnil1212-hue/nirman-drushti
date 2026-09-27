"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Database,
  Send,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getProject,
  getProjectHistory,
  getProjectIntelligence,
  getCostIntelligence,
  getProjectRisk,
  getProjectWarnings,
  getCostRevisionPrediction,
  getScheduleRevisionPrediction,
  getProjectActions,
  askProjectAssistant,
  type ApiProject,
  type ApiProjectHistory,
  type ApiProjectIntelligence,
  type ApiCostIntelligenceResponse,
  type ApiRiskAssessment,
  type ApiEarlyWarning,
  type ApiCostRevisionPrediction,
  type ApiScheduleRevisionPrediction,
  type ApiProjectAction,
  type ApiProjectAssistantResponse,
} from "@/lib/api";
import { AnimatedNumber } from "@/components/AnimatedNumber";

const numeric = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? null : Number(value);

const money = (value: string | number | null | undefined) => {
  const parsed = numeric(value);

  return parsed === null || !Number.isFinite(parsed)
    ? "Not available"
    : `₹${parsed.toLocaleString("en-IN")} Cr`;
};

const percent = (value: string | number | null | undefined) => {
  const parsed = numeric(value);

  return parsed === null || !Number.isFinite(parsed)
    ? "Not available"
    : `${parsed.toLocaleString("en-IN")}%`;
};

const assistantStatusMessage = (response: ApiProjectAssistantResponse) => {
  if (response.status === "project_data_unavailable") {
    return "This information is not available in the current project data.";
  }

  if (response.status === "provider_unavailable") {
    return "DRUSHTI AI is temporarily unavailable because the configured AI provider is unavailable.";
  }

  if (response.status === "provider_quota_exhausted") {
    return "Drushti AI is temporarily unavailable because the configured AI provider has reached its usage limit.";
  }

  if (response.status === "provider_configuration_error") {
    return "DRUSHTI AI is unavailable because its provider configuration needs attention.";
  }

  if (response.status === "invalid_provider_response") {
    return "DRUSHTI AI is temporarily unavailable because the configured AI provider returned an invalid response.";
  }

  return "Drushti AI could not complete the request. Please try again.";
};

const dateLabel = (value: string | null | undefined) => {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const riskLevelClass = (level: string | null | undefined) => {
  if (!level) return "nd-risk-level nd-risk-neutral";

  return `nd-risk-level nd-risk-${level.toLowerCase()}`;
};

const severityClass = (severity: string | null | undefined) => {
  if (!severity) return "nd-severity nd-severity-neutral";

  return `nd-severity nd-severity-${severity.toLowerCase()}`;
};

function SectionHeading({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="nd-section-heading">
      <div className="nd-section-heading-left">
        <span className="nd-section-number">{number}</span>

        <div>
          <h2>{title}</h2>

          {description && (
            <p>{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const displayValue =
    value === null ||
    value === undefined ||
    value === ""
      ? "Not available"
      : String(value);

  return (
    <div className="nd-info-item">
      <span>{label}</span>
      <strong>{displayValue}</strong>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="nd-metric-card">
      <div className="nd-metric-icon">{icon}</div>

      <div className="nd-metric-content">
        <span>{label}</span>
        <strong>{value}</strong>

        {description && (
          <small>{description}</small>
        )}
      </div>
    </div>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [project, setProject] = useState<ApiProject | null>(null);
  const [history, setHistory] =
    useState<ApiProjectHistory | null>(null);
  const [intelligence, setIntelligence] =
    useState<ApiProjectIntelligence | null>(null);
  const [costIntelligence, setCostIntelligence] =
    useState<ApiCostIntelligenceResponse | null>(null);
  const [risk, setRisk] =
    useState<ApiRiskAssessment | null>(null);
  const [warnings, setWarnings] =
    useState<ApiEarlyWarning[]>([]);
  const [costPrediction, setCostPrediction] =
    useState<ApiCostRevisionPrediction | null>(null);
  const [schedulePrediction, setSchedulePrediction] =
    useState<ApiScheduleRevisionPrediction | null>(null);
  const [actions, setActions] =
    useState<ApiProjectAction[]>([]);
  const [assistantQuestion, setAssistantQuestion] =
    useState("");
  const [assistantResponse, setAssistantResponse] =
    useState<ApiProjectAssistantResponse | null>(null);
  const [assistantLoading, setAssistantLoading] =
    useState(false);
  const [assistantError, setAssistantError] =
    useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] =
    useState(false);
  const assistantDrawerRef =
    useRef<HTMLDivElement>(null);
  const assistantInputRef =
    useRef<HTMLInputElement>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const suggestedQuestions = [
    "Why is this project risky?",
    "What changed in this project?",
    "What should be reviewed first?",
    "What are the main warnings?",
  ];

  const askAssistant = async (question = assistantQuestion) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || !project) return;
    setAssistantLoading(true);
    setAssistantError(null);
    setAssistantQuestion(trimmedQuestion);
    try {
      const response = await askProjectAssistant(project.id, trimmedQuestion);
      setAssistantResponse(response);
    } catch (reason) {
      setAssistantError(reason instanceof Error ? reason.message : "The project assistant is unavailable.");
    } finally {
      setAssistantLoading(false);
    }
  };

  useEffect(() => {
    const openFromHeader = (event: Event) => {
      const requestedProjectId = (
        event as CustomEvent<{ projectId?: string }>
      ).detail?.projectId;
      if (requestedProjectId && project && requestedProjectId !== project.id) {
        return;
      }
      setAssistantOpen(true);
    };
    window.addEventListener("drushti-ai:open", openFromHeader);
    return () => window.removeEventListener("drushti-ai:open", openFromHeader);
  }, [project]);

  useEffect(() => {
    if (!assistantOpen) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => assistantInputRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAssistantOpen(false);
        return;
      }
      if (event.key !== "Tab" || !assistantDrawerRef.current) return;

      const focusable = Array.from(
        assistantDrawerRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [assistantOpen]);

  useEffect(() => {
    let mounted = true;

    params.then(({ id: projectId }) => {
      if (!mounted) return;

      setLoading(true);
      setError(null);

      Promise.all([
        getProject(projectId),
        getProjectHistory(projectId),
        getProjectIntelligence(projectId),
        getCostIntelligence(projectId),
        getProjectRisk(projectId),
        getProjectWarnings(projectId),
        getCostRevisionPrediction(projectId),
        getScheduleRevisionPrediction(projectId),
        getProjectActions(projectId),
      ])
        .then(
          ([
            projectResponse,
            historyResponse,
            intelligenceResponse,
            costIntelligenceResponse,
            riskResponse,
            warningResponse,
            predictionResponse,
            scheduleResponse,
            actionsResponse,
          ]) => {
            if (!mounted) return;

            setProject(projectResponse);
            setHistory(historyResponse);
            setIntelligence(intelligenceResponse);
            setCostIntelligence(costIntelligenceResponse);
            setRisk(riskResponse);
            setWarnings(warningResponse);
            setCostPrediction(predictionResponse);
            setSchedulePrediction(scheduleResponse);
            setActions(actionsResponse.actions ?? []);
          },
        )
        .catch((reason) => {
          if (!mounted) return;

          setError(
            reason instanceof Error
              ? reason.message
              : "Project record unavailable.",
          );
        })
        .finally(() => {
          if (mounted) {
            setLoading(false);
          }
        });
    });

    return () => {
      mounted = false;
    };
  }, [params]);

  const progress = useMemo(
    () => history?.progress ?? [],
    [history],
  );

  const costs = useMemo(
    () => history?.costs ?? [],
    [history],
  );

  const progressValues = useMemo(
    () =>
      progress
        .map((item) =>
          numeric(item.physical_progress),
        )
        .filter(
          (item): item is number =>
            item !== null &&
            Number.isFinite(item),
        ),
    [progress],
  );

  if (error) {
    return (
      <>
        <style>{styles}</style>

        <main className="nd-page">
          <div className="nd-container nd-state-container">
            <div className="nd-state-card nd-error-state">
              <div className="nd-state-icon">
                <AlertTriangle size={22} />
              </div>

              <h2>Unable to load project</h2>

              <p>{error}</p>

              <Link
                href="/projects"
                className="nd-primary-button"
              >
                <ArrowLeft size={15} />
                Back to project register
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (
    loading ||
    !project ||
    !history ||
    !intelligence ||
    !costIntelligence ||
    !risk ||
    !costPrediction ||
    !schedulePrediction
  ) {
    return (
      <>
        <style>{styles}</style>

        <main className="nd-page">
          <div className="nd-container nd-state-container">
            <div className="nd-state-card">
              <div className="nd-loading-spinner" />

              <h2>Loading project record</h2>

              <p>
                Retrieving project history and
                intelligence...
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  const currentProgress = numeric(
    project.physical_progress,
  );

  const expectedProgress = numeric(
    project.expected_progress,
  );

  const expenditurePercentage = numeric(
    intelligence.cost.expenditure_percentage,
  );

  const dataCoverage = numeric(
    risk.data_coverage,
  );

  const featureCoverage = numeric(
    costIntelligence.prediction.feature_coverage,
  );

  return (
    <>
      <style>{styles}</style>

      <main className="nd-page" aria-hidden={assistantOpen}>

        {/* =========================================================
            HERO
        ========================================================= */}

        <section className="nd-project-hero">
          <div className="nd-container">

            <div className="nd-dossier-header-actions">
              <Link
                href="/projects"
                className="nd-back-link"
              >
                <ArrowLeft size={15} />
                Back to Project Register
              </Link>

            </div>

            <div className="nd-hero-layout">

              <div className="nd-hero-main">

                <div className="nd-record-label">
                  <Database size={13} />
                  Infrastructure project record
                </div>

                <h1>
                  {project.name ||
                    "Project name not available"}
                </h1>

                <p className="nd-hero-meta">
                  <span>
                    {project.implementing_agency ||
                      "Agency not available"}
                  </span>

                  <b>•</b>

                  <span>
                    {project.state ||
                      "State not available"}
                  </span>

                  <b>•</b>

                  <span>
                    {project.sector ||
                      "Sector not available"}
                  </span>
                </p>

              </div>

              <div className="nd-identity-card">

                <span>PROJECT IDENTITY</span>

                <strong>
                  {project.project_identity ||
                    "Not available"}
                </strong>

                <small>
                  Observed through PAIMANA
                  reporting
                </small>

              </div>

            </div>

            {/* TOP METRICS */}

            <div className="nd-hero-metrics">

              <div>
                <span>Physical progress</span>

                <strong>
                  {percent(
                    project.physical_progress,
                  )}
                </strong>
              </div>

              <div>
                <span>Current cost</span>

                <strong>
                  {money(project.current_cost)}
                </strong>
              </div>

              <div>
                <span>Monitoring status</span>

                <strong>
                  {project.status ||
                    "Not available"}
                </strong>
              </div>

              <div>
                <span>Risk level</span>

                <strong
                  className={riskLevelClass(
                    risk.level,
                  )}
                >
                  {risk.level ||
                    "Not available"}
                </strong>
              </div>

            </div>
          </div>
        </section>

        {/* =========================================================
            PROJECT OVERVIEW
        ========================================================= */}

        <section className="nd-section nd-reveal">
          <div className="nd-container">

            <SectionHeading
              number="01"
              title="Project overview"
              description="Core identity and administrative information."
            />

            <div className="nd-info-grid">

              <InfoItem
                label="Project code"
                value={project.project_code}
              />

              <InfoItem
                label="Legacy OCMS code"
                value={
                  project.legacy_ocms_code
                }
              />

              <InfoItem
                label="PMGID"
                value={project.pmgid}
              />

              <InfoItem
                label="Ministry"
                value={project.ministry}
              />

              <InfoItem
                label="Department"
                value={
                  project.department
                }
              />

              <InfoItem
                label="Implementing agency"
                value={
                  project.implementing_agency
                }
              />

              <InfoItem
                label="Sector"
                value={project.sector}
              />

              <InfoItem
                label="State"
                value={project.state}
              />

              <InfoItem
                label="Location"
                value={project.location}
              />

              <InfoItem
                label="Monitoring status"
                value={project.status}
              />

            </div>
          </div>
        </section>

        {/* =========================================================
            FINANCIAL
        ========================================================= */}

        <section className="nd-section nd-section-soft nd-reveal">
          <div className="nd-container">

            <SectionHeading
              number="02"
              title="Financial record"
              description="Reported project cost and expenditure position."
            />

            <div className="nd-metrics-grid">

              <MetricCard
                icon={<Wallet size={18} />}
                label="Original approved cost"
                value={<AnimatedNumber value={numeric(project.original_cost)} format={(value) => money(value)} />}
                description="Reported value"
              />

              <MetricCard
                icon={<TrendingUp size={18} />}
                label="Latest current cost"
                value={<AnimatedNumber value={numeric(project.current_cost)} format={(value) => money(value)} />}
                description="Reported value"
              />

              <MetricCard
                icon={<Activity size={18} />}
                label="Cumulative expenditure"
                value={<AnimatedNumber value={numeric(project.expenditure)} format={(value) => money(value)} />}
                description="Reported value"
              />

              <MetricCard
                icon={<Database size={18} />}
                label="Expenditure position"
                value={<AnimatedNumber value={expenditurePercentage} format={(value) => `${value.toLocaleString("en-IN")}%`} />}
                description="Share of latest cost"
              />

            </div>

            <CostPressureDiagram
              originalCost={numeric(project.original_cost)}
              currentCost={numeric(project.current_cost)}
              expenditure={numeric(project.expenditure)}
            />
          </div>
        </section>

        {/* =========================================================
            SCHEDULE
        ========================================================= */}

        <section className="nd-section nd-reveal">
          <div className="nd-container">

            <SectionHeading
              number="03"
              title="Schedule & progress"
              description="Reported schedule dates and physical progress."
            />

            <div className="nd-schedule-layout">

              <div className="nd-info-grid">

                <InfoItem
                  label="Planned start date"
                  value={dateLabel(
                    project.planned_start_date,
                  )}
                />

                <InfoItem
                  label="Planned completion"
                  value={dateLabel(
                    project.planned_completion_date,
                  )}
                />

                <InfoItem
                  label="Expected completion"
                  value={dateLabel(
                    project.expected_completion_date,
                  )}
                />

                <InfoItem
                  label="Physical progress"
                  value={percent(
                    project.physical_progress,
                  )}
                />

                <InfoItem
                  label="Expected progress"
                  value={percent(
                    project.expected_progress,
                  )}
                />

              </div>

              <div className="nd-progress-card">

                <div className="nd-progress-header">

                  <div>
                    <span>Physical progress</span>

                    <strong>
                      {currentProgress === null
                        ? "Not available"
                        : `${currentProgress}%`}
                    </strong>
                  </div>

                  <CalendarDays size={18} />

                </div>

                <div className="nd-large-progress-track">
                  <div
                    className="nd-large-progress-bar"
                    style={{
                      width:
                        currentProgress === null
                          ? "0%"
                          : `${Math.min(
                              Math.max(
                                currentProgress,
                                0,
                              ),
                              100,
                            )}%`,
                    }}
                  />
                </div>

                <div className="nd-progress-comparison">

                  <span>
                    Expected:{" "}
                    {expectedProgress ===
                    null
                      ? "Not available"
                      : `${expectedProgress}%`}
                  </span>

                  <span>
                    {currentProgress !== null &&
                    expectedProgress !== null
                      ? currentProgress >=
                        expectedProgress
                        ? "At / above expected"
                        : "Below expected"
                      : "Comparison unavailable"}
                  </span>

                </div>

              </div>

            </div>

            <ProgressSignalDiagram
              current={currentProgress}
              expected={expectedProgress}
              progress={progress}
            />
          </div>
        </section>

        {/* =========================================================
            RISK
        ========================================================= */}

        <section className="nd-section nd-section-soft nd-reveal">
          <div className="nd-container">

            <SectionHeading
              number="04"
              title="Risk assessment"
              description="Rule-based operational assessment from reported observations."
            />

            <div className="nd-risk-summary">

              <div className="nd-risk-main">

                <div className="nd-risk-main-top">
                  <span>Overall risk</span>

                  <ShieldAlert size={19} />
                </div>

                <strong
                  className={riskLevelClass(
                    risk.level,
                  )}
                >
                  {risk.level ||
                    "Not available"}
                </strong>

                <p>
                  {risk.explanation ||
                    "No risk explanation available."}
                </p>

              </div>

              <div className="nd-risk-stat">
                <span>Risk score</span>
                <strong>
                  <AnimatedNumber value={numeric(risk.score)} format={(value) => value.toLocaleString("en-IN")} />
                </strong>
                <small>0–100 heuristic score</small>
              </div>

              <div className="nd-risk-stat">
                <span>Data coverage</span>
                <strong>
                  {dataCoverage === null
                    ? "Not available"
                    : <AnimatedNumber value={dataCoverage * 100} format={(value) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`} />}
                </strong>
                <small>
                  {risk.confidence_label ||
                    "Confidence unavailable"}
                </small>
              </div>

            </div>

            {/* RISK FACTORS */}

            <div className="nd-subsection">

              <div className="nd-subsection-heading">
                <div>
                  <h3>Risk factors</h3>
                  <p>
                    Available signals contributing to
                    the operational assessment.
                  </p>
                </div>
              </div>

              <div className="nd-risk-factor-grid">

                {risk.factors
                  .filter(
                    (factor) =>
                      factor.available &&
                      factor.factor !==
                        "data_coverage",
                  )
                  .map((factor) => (
                    <article
                      className="nd-risk-factor-card"
                      key={factor.factor}
                    >

                      <div className="nd-factor-top">

                        <strong>
                          {factor.factor.replaceAll(
                            "_",
                            " ",
                          )}
                        </strong>

                        <span
                          className={severityClass(
                            factor.severity,
                          )}
                        >
                          {factor.severity}
                        </span>

                      </div>

                      <div className="nd-factor-value">
                        {factor.value === null
                          ? "Not available"
                          : `${factor.value}${
                              factor.unit
                                ? ` ${factor.unit}`
                                : ""
                            }`}
                      </div>

                      <p>
                        {factor.explanation}
                      </p>

                    </article>
                  ))}

              </div>

              {!risk.factors.some(
                (factor) =>
                  factor.available &&
                  factor.factor !==
                    "data_coverage",
              ) && (
                <div className="nd-unavailable-card">
                  <strong>
                    Insufficient reported history
                  </strong>

                  <p>
                    No scored risk factor is currently
                    available for this project.
                  </p>
                </div>
              )}

            </div>

            <RiskSignalDiagram
              score={numeric(risk.score)}
              factors={risk.factors}
            />

            {/* WARNINGS */}

            {warnings.length > 0 && (
              <div className="nd-subsection">

                <div className="nd-subsection-heading">
                  <div>
                    <h3>Early warnings</h3>
                    <p>
                      Reported signals requiring
                      operational attention.
                    </p>
                  </div>

                  <span className="nd-count-badge">
                    {warnings.length}
                  </span>
                </div>

                <div className="nd-warning-list">

                  {warnings.map((warning) => (
                    <article
                      className="nd-warning-card"
                      key={warning.warning_id}
                    >

                      <div className="nd-warning-top">

                        <div className="nd-warning-tags">

                          <span
                            className={severityClass(
                              warning.severity,
                            )}
                          >
                            {warning.severity}
                          </span>

                          <span className="nd-source-badge">
                            {warning.source_type ===
                            "DATA_QUALITY"
                              ? "DATA QUALITY"
                              : warning.source_type}
                          </span>

                          <span className="nd-warning-type">
                            {warning.type.replaceAll(
                              "_",
                              " ",
                            )}
                          </span>

                        </div>

                        <AlertTriangle
                          size={18}
                        />

                      </div>

                      <div className="nd-warning-content">

                        <div>
                          <h4>
                            {warning.title}
                          </h4>

                          <p>
                            {warning.message}
                          </p>
                        </div>

                        <div className="nd-recommended-check">

                          <span>
                            Recommended attention
                          </span>

                          <strong>
                            {warning.recommended_action}
                          </strong>

                        </div>

                      </div>

                    </article>
                  ))}

                </div>
              </div>
            )}

          </div>
        </section>

        {/* =========================================================
            PREDICTIONS
        ========================================================= */}

        <section className="nd-section nd-reveal">
          <div className="nd-container">

            <SectionHeading
              number="05"
              title="Predictive signals"
              description="Future reported-revision predictions based on available historical observations."
            />

            <div className="nd-prediction-grid">

              {/* COST */}

              <div className="nd-prediction-card">

                <div className="nd-card-header">

                  <div>
                    <span>Cost revision</span>
                    <h3>
                      Future reported cost revision
                    </h3>
                  </div>

                  <TrendingUp size={19} />

                </div>

                {costPrediction.availability ===
                "AVAILABLE" ? (
                  <>

                    <div className="nd-prediction-result">

                      <strong>
                        {costPrediction.prediction
                          ? "Revision indicated"
                          : "No revision indicated"}
                      </strong>

                      <span>
                        Probability{" "}
                        <AnimatedNumber value={numeric(costPrediction.probability) === null ? null : numeric(costPrediction.probability)! * 100} format={(value) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`} />
                      </span>

                    </div>

                    <div className="nd-prediction-meta">
                      <span>
                        Model{" "}
                        {costPrediction.model_version ||
                          "Not available"}
                      </span>

                      <span>
                        Cutoff{" "}
                        {costPrediction.cutoff_reporting_period ||
                          "Not available"}
                      </span>
                    </div>

                    <div className="nd-coverage-row">
                      <span>
                        Feature coverage
                      </span>

                      <strong>
                        {featureCoverage ===
                        null
                          ? "Not available"
                          : `${(
                              featureCoverage * 100
                            ).toLocaleString(
                              "en-IN",
                              {
                                maximumFractionDigits: 1,
                              },
                            )}%`}
                      </strong>
                    </div>

                    {costPrediction.explanation && (
                      <div className="nd-model-explanation">

                        <h4>
                          Model explanation
                        </h4>

                        <p>
                          {
                            costPrediction
                              .explanation.model_note
                          }
                        </p>

                        <div className="nd-signal-grid">

                          <SignalList
                            title="Higher-likelihood signals"
                            signals={
                              costPrediction
                                .explanation
                                .positive_signals
                            }
                            positive
                          />

                          <SignalList
                            title="Lower-likelihood signals"
                            signals={
                              costPrediction
                                .explanation
                                .negative_signals
                            }
                          />

                        </div>

                      </div>
                    )}

                  </>
                ) : (
                  <UnavailablePrediction
                    text="Insufficient historical observations for a leakage-safe future reported-revision prediction."
                  />
                )}

              </div>

              {/* SCHEDULE */}

              <div className="nd-prediction-card">

                <div className="nd-card-header">

                  <div>
                    <span>Schedule revision</span>
                    <h3>
                      Future reported schedule revision
                    </h3>
                  </div>

                  <CalendarDays size={19} />

                </div>

                {schedulePrediction.availability ===
                "AVAILABLE" ? (
                  <>

                    <div className="nd-prediction-result">

                      <strong>
                        {schedulePrediction.prediction
                          ? "Revision indicated"
                          : "No revision indicated"}
                      </strong>

                      <span>
                        Probability{" "}
                        <AnimatedNumber value={numeric(schedulePrediction.probability) === null ? null : numeric(schedulePrediction.probability)! * 100} format={(value) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`} />
                      </span>

                    </div>

                    <div className="nd-prediction-meta">
                      <span>
                        Model{" "}
                        {schedulePrediction.model_version ||
                          "Not available"}
                      </span>

                      <span>
                        Cutoff{" "}
                        {schedulePrediction.cutoff_reporting_period ||
                          "Not available"}
                      </span>
                    </div>

                    <div className="nd-coverage-row">
                      <span>
                        Feature coverage
                      </span>

                      <strong>
                        {numeric(
                          schedulePrediction.feature_coverage,
                        ) === null
                          ? "Not available"
                          : `${(
                              Number(
                                schedulePrediction.feature_coverage,
                              ) * 100
                            ).toLocaleString(
                              "en-IN",
                              {
                                maximumFractionDigits: 1,
                              },
                            )}%`}
                      </strong>
                    </div>

                  </>
                ) : (
                  <UnavailablePrediction
                    text="Insufficient historical observations for a leakage-safe future reported schedule-revision prediction."
                  />
                )}

              </div>

            </div>

          </div>
        </section>

        {/* =========================================================
            DETERMINISTIC INTELLIGENCE
        ========================================================= */}

        <section className="nd-section nd-section-soft nd-reveal">
          <div className="nd-container">

            <SectionHeading
              number="06"
              title="Deterministic intelligence"
              description="Derived only from the reported project record and ordered historical observations."
            />

            <div className="nd-prediction-card nd-cost-intelligence-panel">
              <div className="nd-card-header">
                <div>
                  <span>Cost intelligence</span>
                  <h3>Current cost-overrun assessment</h3>
                </div>
                <Wallet size={19} />
              </div>

              <p className="nd-panel-label">REPORTED / DERIVED</p>
              <div className="nd-intelligence-grid">
                <MetricCard icon={<Wallet size={18} />} label="Original cost" value={<AnimatedNumber value={numeric(costIntelligence.original_cost)} format={(value) => money(value)} />} description="Reported original cost" />
                <MetricCard icon={<TrendingUp size={18} />} label="Current / revised cost" value={<AnimatedNumber value={numeric(costIntelligence.revised_current_cost)} format={(value) => money(value)} />} description="Latest reported cost" />
                <MetricCard icon={<Wallet size={18} />} label="Expenditure" value={<AnimatedNumber value={numeric(costIntelligence.expenditure)} format={(value) => money(value)} />} description="Cumulative reported expenditure" />
                <MetricCard icon={<TrendingUp size={18} />} label="Current cost overrun" value={<AnimatedNumber value={numeric(costIntelligence.current_cost_overrun_amount)} format={(value) => money(value)} />} description={costIntelligence.current_cost_overrun_percentage == null ? "Unavailable" : `${numeric(costIntelligence.current_cost_overrun_percentage)?.toLocaleString("en-IN", { maximumFractionDigits: 1 })}% of original cost`} />
                <MetricCard icon={<Activity size={18} />} label="Overrun %" value={<AnimatedNumber value={numeric(costIntelligence.current_cost_overrun_percentage)} format={(value) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`} />} description="Current assessment" />
                <MetricCard icon={<TrendingUp size={18} />} label="Above revised cost" value={<AnimatedNumber value={numeric(costIntelligence.amount_above_revised_cost)} format={(value) => money(value)} />} description={costIntelligence.expenditure_exceeds_revised_cost ? "Expenditure exceeds revised cost" : "Not applicable"} />
              </div>

              <p className="nd-panel-label">PREDICTED</p>
              <div className="nd-prediction-meta">
                <span>Future reported cost revision: {costIntelligence.prediction.availability === "AVAILABLE" ? (costIntelligence.prediction.prediction ? "Revision indicated" : "No revision indicated") : "Insufficient data"}</span>
                <span>Probability <AnimatedNumber value={numeric(costIntelligence.prediction.probability) === null ? null : numeric(costIntelligence.prediction.probability)! * 100} format={(value) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`} /></span>
                <span>Cutoff {costIntelligence.prediction.cutoff_reporting_period || "Not available"}</span>
                <span>Model {costIntelligence.prediction.model_version || "Not available"}</span>
                <span>Coverage <AnimatedNumber value={featureCoverage == null ? null : featureCoverage * 100} format={(value) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`} /></span>
              </div>
              {costIntelligence.limitations.map((limitation) => (
                <p className="nd-card-note" key={limitation}>{limitation}</p>
              ))}
            </div>

            <div className="nd-intelligence-grid">

              <MetricCard
                icon={<TrendingUp size={18} />}
                label="Cost escalation"
                value={money(
                  intelligence.cost
                    .absolute_increase,
                )}
                description={
                  intelligence.cost
                    .escalation_percentage ==
                  null
                    ? "Percentage unavailable"
                    : `${numeric(
                        intelligence.cost
                          .escalation_percentage,
                      )?.toLocaleString(
                        "en-IN",
                      )}% of original cost`
                }
              />

              <MetricCard
                icon={<Wallet size={18} />}
                label="Expenditure position"
                value={
                  intelligence.cost
                    .expenditure_percentage ==
                  null
                    ? "Not available"
                    : `${numeric(
                        intelligence.cost
                          .expenditure_percentage,
                      )?.toLocaleString(
                        "en-IN",
                      )}%`
                }
                description="Expenditure as a share of latest cost"
              />

              <MetricCard
                icon={<Activity size={18} />}
                label="Progress movement"
                value={percent(
                  intelligence.progress
                    .progress_change,
                )}
                description={`${intelligence.progress.trend || "Trend unavailable"} / ${intelligence.progress.observation_count} observations`}
              />

              <MetricCard
                icon={<CalendarDays size={18} />}
                label="Schedule extension"
                value={
                  intelligence.schedule
                    .extension_days == null
                    ? "Not available"
                    : `${intelligence.schedule.extension_days} days`
                }
                description={
                  intelligence.schedule
                    .has_extension == null
                    ? "Completion comparison unavailable"
                    : intelligence.schedule
                          .has_extension
                      ? `${intelligence.schedule.extension_months} months indicated`
                      : "No extension indicated"
                }
              />

            </div>

            <div className="nd-unavailable-card nd-intelligence-note">

              <div>
                <strong>
                  Other predictive intelligence
                  unavailable
                </strong>

                <p>
                  No time-overrun model, SHAP
                  explanation, or final/audited
                  cost-overrun prediction is
                  available.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* =========================================================
            ACTIONS
        ========================================================= */}

        <section className="nd-section nd-reveal">
          <div className="nd-container">

            <SectionHeading
              number="07"
              title="Project actions"
              description="Deterministic actions generated from available risk, warning and data-quality signals."
            />

            <div className="nd-actions-header">

              <div className="nd-action-summary">
                <CheckCircle2 size={17} />

                <span>
                  {actions.length} deterministic action
                  {actions.length === 1
                    ? ""
                    : "s"} generated
                </span>
              </div>

            </div>

            {actions.length > 0 ? (
              <div className="nd-actions-list">

                {actions.map((action) => (
                  <article
                    className="nd-action-card"
                    key={action.action_id}
                  >

                    <div className="nd-action-top">

                      <div className="nd-action-title-wrap">

                        <span
                          className={severityClass(
                            action.priority,
                          )}
                        >
                          {action.priority}
                        </span>

                        <span className="nd-source-badge">
                          Source:{" "}
                          {action.source.replaceAll(
                            "_",
                            " ",
                          )}
                        </span>

                      </div>

                    </div>

                    <h3>
                      {action.title}
                    </h3>

                    <p className="nd-action-reason">
                      <strong>
                        Why generated:
                      </strong>{" "}
                      {action.reason}
                    </p>

                    <div className="nd-action-grid">

                      <div>
                        <span>Evidence</span>
                        <p>
                          {action.evidence}
                        </p>
                      </div>

                      <div>
                        <span>
                          Recommended verification
                        </span>
                        <p>
                          {action.recommended_check}
                        </p>
                      </div>

                    </div>

                  </article>
                ))}

              </div>
            ) : (
              <div className="nd-unavailable-card">

                <CheckCircle2 size={18} />

                <div>
                  <strong>
                    No actions generated
                  </strong>

                  <p>
                    No active risk factor, warning
                    signal, or data-quality gap was
                    detected for this project.
                  </p>
                </div>

              </div>
            )}

          </div>
        </section>

        {/* =========================================================
            HISTORY
        ========================================================= */}

        <section className="nd-section nd-section-soft nd-reveal">
          <div className="nd-container">

            <SectionHeading
              number="08"
              title="Historical performance"
              description="Historical observations retained with their reporting period and source file."
            />

            {progress.length === 0 &&
            costs.length === 0 ? (
              <div className="nd-unavailable-card">

                <Database size={18} />

                <div>
                  <strong>
                    Historical data unavailable
                  </strong>

                  <p>
                    No historical observations are
                    currently recorded for this
                    project.
                  </p>
                </div>

              </div>
            ) : (
              <div className="nd-history-layout">

                {/* PROGRESS CHART */}

 {/* PROGRESS LINE CHART */}

<div className="nd-history-chart-card">

  <div className="nd-card-header">
    <div>
      <span>Progress trajectory</span>

      <h3>Physical progress</h3>
    </div>

    <Activity size={18} />
  </div>

  {progress.length > 0 ? (
    (() => {
      const chartData = progress.reduce<
        Array<{
          id: string;
          date: string | null;
          value: number;
        }>
      >((result, item) => {
        const value = numeric(item.physical_progress);

        if (
          value === null ||
          !Number.isFinite(value)
        ) {
          return result;
        }

        result.push({
          id: String(item.id),
          date: item.reporting_period ?? null,
          value,
        });

        return result;
      }, []);

      if (chartData.length === 0) {
        return (
          <div className="nd-chart-empty">
            No progress observations available.
          </div>
        );
      }

      const width = 820;
      const height = 320;

      const left = 60;
      const right = 20;
      const top = 25;
      const bottom = 55;

      const chartWidth =
        width - left - right;

      const chartHeight =
        height - top - bottom;

      const points = chartData.map(
        (item, index) => {
          const x =
            chartData.length === 1
              ? left + chartWidth / 2
              : left +
                (index /
                  (chartData.length - 1)) *
                  chartWidth;

          const value = Math.max(
            0,
            Math.min(100, item.value),
          );

          const y =
            top +
            ((100 - value) / 100) *
              chartHeight;

          return {
            id: item.id,
            date: item.date,
            value,
            x,
            y,
          };
        },
      );

      const linePath = points
        .map(
          (point, index) =>
            `${index === 0 ? "M" : "L"} ${
              point.x
            } ${point.y}`,
        )
        .join(" ");

      const firstPoint =
        points.length > 0
          ? points[0]
          : null;

      const lastPoint =
        points.length > 0
          ? points[points.length - 1]
          : null;

      const areaPath =
        firstPoint && lastPoint
          ? `
              ${linePath}
              L ${lastPoint.x} ${
                top + chartHeight
              }
              L ${firstPoint.x} ${
                top + chartHeight
              }
              Z
            `
          : "";

      const latestPoint = lastPoint;

      return (
        <div className="nd-line-chart">

          <div className="nd-line-chart-meta">
            <span>
              Physical progress over reporting periods
            </span>

            <strong>
              {latestPoint
                ? latestPoint.value.toFixed(1)
                : "Not available"}
              {latestPoint ? "%" : ""}
            </strong>
          </div>

          <svg
            className="nd-progress-line-svg"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Physical progress history"
          >

            {/* Horizontal grid */}

            {[100, 75, 50, 25, 0].map(
              (value) => {
                const y =
                  top +
                  ((100 - value) / 100) *
                    chartHeight;

                return (
                  <g key={value}>

                    <line
                      x1={left}
                      x2={width - right}
                      y1={y}
                      y2={y}
                      className="nd-chart-grid-line"
                    />

                    <text
                      x={left - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="nd-chart-axis-label"
                    >
                      {value}%
                    </text>

                  </g>
                );
              },
            )}

            {/* Area */}

            {areaPath ? (
              <path
                d={areaPath}
                className="nd-progress-area"
              />
            ) : null}

            {/* Line */}

            {linePath ? (
              <path
                d={linePath}
                className="nd-progress-line"
                fill="none"
              />
            ) : null}

            {/* Points */}

            {points.map((point) => (
              <g key={point.id}>

                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  className="nd-progress-point"
                />

                <text
                  x={point.x}
                  y={point.y - 12}
                  textAnchor="middle"
                  className="nd-progress-value"
                >
                  {point.value.toFixed(0)}%
                </text>

              </g>
            ))}

            {/* X-axis labels */}

            {points.map((point) => (
              <text
                key={`label-${point.id}`}
                x={point.x}
                y={height - 18}
                textAnchor="middle"
                className="nd-chart-axis-label"
              >
                {dateLabel(point.date)}
              </text>
            ))}

          </svg>

          <div className="nd-chart-legend">
            <span className="nd-legend-line" />
            Physical progress
          </div>

        </div>
      );
    })()
  ) : (
    <div className="nd-chart-empty">
      No progress observations available.
    </div>
  )}

</div>

                {/* HISTORY TABLE */}

                <div className="nd-history-tables">

                  <div className="nd-history-block">

                    <div className="nd-table-heading">
                      <h3>
                        Progress history
                      </h3>

                      <span>
                        {progress.length} observations
                      </span>
                    </div>

                    <div className="nd-table-wrap">

                      <table className="nd-history-table">

                        <thead>
                          <tr>
                            <th>Period</th>
                            <th>Progress</th>
                            <th>Expenditure</th>
                            <th>Source file</th>
                          </tr>
                        </thead>

                        <tbody>

                          {progress.map(
                            (item) => (
                              <tr key={item.id}>

                                <td>
                                  {dateLabel(
                                    item.reporting_period,
                                  )}
                                </td>

                                <td className="nd-table-strong">
                                  {percent(
                                    item.physical_progress,
                                  )}
                                </td>

                                <td>
                                  {money(
                                    item.expenditure,
                                  )}
                                </td>

                                <td>
                                  {item.source_filename ||
                                    "Not available"}
                                </td>

                              </tr>
                            ),
                          )}

                        </tbody>

                      </table>

                    </div>

                  </div>

                  <div className="nd-history-block">

                    <div className="nd-table-heading">
                      <h3>
                        Cost history
                      </h3>

                      <span>
                        {costs.length} observations
                      </span>
                    </div>

                    <div className="nd-table-wrap">

                      <table className="nd-history-table">

                        <thead>
                          <tr>
                            <th>Recorded</th>
                            <th>Original cost</th>
                            <th>Current cost</th>
                            <th>Expenditure</th>
                            <th>Source file</th>
                          </tr>
                        </thead>

                        <tbody>

                          {costs.map(
                            (item) => (
                              <tr key={item.id}>

                                <td>
                                  {dateLabel(
                                    item.recorded_at,
                                  )}
                                </td>

                                <td>
                                  {money(
                                    item.original_cost,
                                  )}
                                </td>

                                <td className="nd-table-strong">
                                  {money(
                                    item.current_cost,
                                  )}
                                </td>

                                <td>
                                  {money(
                                    item.expenditure,
                                  )}
                                </td>

                                <td>
                                  {item.source_filename ||
                                    "Not available"}
                                </td>

                              </tr>
                            ),
                          )}

                        </tbody>

                      </table>

                    </div>

                  </div>

                </div>

              </div>
            )}

          </div>
        </section>

      </main>

      {assistantOpen && (
        <>
          <button
            type="button"
            className="nd-assistant-backdrop"
            aria-label="Close Drushti AI assistant"
            onClick={() => setAssistantOpen(false)}
          />

          <aside
            ref={assistantDrawerRef}
            className="nd-assistant-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drushti-ai-title"
          >
            <div className="nd-assistant-drawer-header">
              <div>
                <span className="nd-panel-label">DRUSHTI AI</span>
                <h2 id="drushti-ai-title">Project Intelligence Assistant</h2>
              </div>
              <button
                type="button"
                className="nd-icon-button"
                aria-label="Close Drushti AI assistant"
                onClick={() => setAssistantOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="nd-assistant-drawer-body">
              <div className="nd-assistant-suggestions">
                {suggestedQuestions.map((question) => (
                  <button
                    type="button"
                    className="nd-secondary-button"
                    key={question}
                    onClick={() => {
                      setAssistantQuestion(question);
                      void askAssistant(question);
                    }}
                    disabled={assistantLoading}
                  >
                    {question}
                  </button>
                ))}
              </div>

              <form
                className="nd-assistant-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void askAssistant();
                }}
              >
                <label className="nd-sr-only" htmlFor="drushti-ai-question">Ask a project-specific question</label>
                <input
                  ref={assistantInputRef}
                  id="drushti-ai-question"
                  className="nd-input"
                  value={assistantQuestion}
                  onChange={(event) => setAssistantQuestion(event.target.value)}
                  placeholder="Ask a project-specific question"
                  maxLength={2000}
                  disabled={assistantLoading}
                />
                <button className="nd-primary-button" type="submit" disabled={assistantLoading || !assistantQuestion.trim()}>
                  <Send size={15} />
                  {assistantLoading ? "Reviewing..." : "Ask"}
                </button>
              </form>

              {assistantLoading && (
                <div className="nd-assistant-loading" role="status" aria-live="polite">
                  <span className="nd-loading-spinner" />
                  Reviewing verified project data...
                </div>
              )}

              {assistantError && (
                <div className="nd-assistant-unavailable" role="alert">
                  <strong>Assistant unavailable</strong>
                  <p>{assistantError}</p>
                </div>
              )}

              {assistantResponse && !assistantLoading && (
                <div className="nd-assistant-response">
                  {assistantResponse.status !== "success" ? (
                    <div className="nd-assistant-unavailable">
                      <strong>
                        {assistantResponse.status === "project_data_unavailable"
                          ? "Project data unavailable"
                          : "Assistant unavailable"}
                      </strong>
                      <p>{assistantStatusMessage(assistantResponse)}</p>
                      {assistantResponse.data_limitations.map((item) => <p key={item}>{item}</p>)}
                    </div>
                  ) : (
                    <>
                      <p className="nd-panel-label">ANSWER</p>
                      <p>{assistantResponse.answer}</p>
                      {assistantResponse.key_points.length > 0 && (
                        <>
                          <p className="nd-panel-label">KEY POINTS</p>
                          <ul>{assistantResponse.key_points.map((point) => <li key={point}>{point}</li>)}</ul>
                        </>
                      )}
                      <p className="nd-panel-label">EVIDENCE USED</p>
                      {assistantResponse.evidence_used.length > 0 ? (
                        <ul>{assistantResponse.evidence_used.map((item) => <li key={item}>{item}</li>)}</ul>
                      ) : <p>This information is not available in the current project data.</p>}
                      {assistantResponse.data_limitations.length > 0 && (
                        <>
                          <p className="nd-panel-label">DATA LIMITATIONS</p>
                          <ul>{assistantResponse.data_limitations.map((item) => <li key={item}>{item}</li>)}</ul>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

/* ================================================================
   SIGNAL LIST
================================================================ */

function SignalList({
  title,
  signals,
  positive = false,
}: {
  title: string;
  signals: {
    feature: string;
    contribution: number | string;
    value: string;
  }[];
  positive?: boolean;
}) {
  return (
    <div className="nd-signal-list">

      <span>{title}</span>

      {signals.length === 0 ? (
        <p className="nd-no-signal">
          No strong signals
        </p>
      ) : (
        signals.map((signal) => (
          <div
            className="nd-signal"
            key={signal.feature}
          >

            <div>
              <strong>
                {signal.feature.replaceAll(
                  "_",
                  " ",
                )}
              </strong>

              <b
                className={
                  positive
                    ? "nd-contribution-positive"
                    : "nd-contribution-negative"
                }
              >
                {positive ? "+" : ""}
                {Number(
                  signal.contribution,
                ).toFixed(2)}
              </b>
            </div>

            <small>
              {signal.value}
            </small>

          </div>
        ))
      )}

    </div>
  );
}

/* ================================================================
   UNAVAILABLE PREDICTION
================================================================ */

function UnavailablePrediction({
  text,
}: {
  text: string;
}) {
  return (
    <div className="nd-prediction-unavailable">

      <div className="nd-unavailable-icon">
        <Database size={17} />
      </div>

      <strong>
        Data unavailable
      </strong>

      <p>{text}</p>

    </div>
  );
}

/* ================================================================
   STATIC DATA-DERIVED DIAGRAMS
================================================================ */

function DiagramFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="nd-diagram-frame">
      <div className="nd-diagram-heading">
        <div>
          <span>{eyebrow}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="nd-diagram-index">DATA VIEW</span>
      </div>
      {children}
    </div>
  );
}

function CostPressureDiagram({
  originalCost,
  currentCost,
  expenditure,
}: {
  originalCost: number | null;
  currentCost: number | null;
  expenditure: number | null;
}) {
  const values = [originalCost, currentCost, expenditure];
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (available.length === 0) return null;

  const max = Math.max(...available, 1);
  const items = [
    { label: "Original", value: originalCost, tone: "base" },
    { label: "Current", value: currentCost, tone: "current" },
    { label: "Expenditure", value: expenditure, tone: "spend" },
  ];

  return (
    <DiagramFrame
      eyebrow="FINANCIAL POSITION"
      title="Cost pressure at a glance"
      description="Reported financial values shown on one common scale."
    >
      <div className="nd-cost-diagram">
        {items.map((item, index) => {
          const width = item.value === null || !Number.isFinite(item.value)
            ? 0
            : Math.max(3, (item.value / max) * 100);
          return (
            <div className="nd-cost-row" key={item.label} style={{ "--nd-delay": `${index * 90}ms` } as React.CSSProperties}>
              <div className="nd-cost-row-label">
                <span>{item.label}</span>
                <strong>{item.value === null || !Number.isFinite(item.value) ? "Not available" : money(item.value)}</strong>
              </div>
              <div className="nd-cost-track" aria-hidden="true">
                <div className={`nd-cost-bar nd-cost-bar-${item.tone}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </DiagramFrame>
  );
}

function ProgressSignalDiagram({
  current,
  expected,
  progress,
}: {
  current: number | null;
  expected: number | null;
  progress: ApiProjectHistory["progress"];
}) {
  const points: Array<{ value: number; date: string }> = progress.flatMap((item) => {
    const value = numeric(item.physical_progress);

    if (value === null || !Number.isFinite(value)) {
      return [];
    }

    return [{
      value,
      date: item.reporting_period,
    }];
  });

  if (current === null && expected === null && points.length === 0) return null;

  const currentWidth = current === null ? 0 : Math.min(100, Math.max(0, current));
  const expectedWidth = expected === null ? 0 : Math.min(100, Math.max(0, expected));

  return (
    <DiagramFrame
      eyebrow="DELIVERY SIGNAL"
      title="Physical progress versus expectation"
      description="The comparison is derived from the project's reported progress fields."
    >
      <div className="nd-progress-diagram">
        <div className="nd-progress-axis">
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
        <div className="nd-progress-compare">
          <span>Expected</span>
          <div className="nd-compare-track"><div className="nd-compare-fill nd-compare-expected" style={{ width: `${expectedWidth}%` }} /></div>
          <strong>{expected === null ? "N/A" : `${expected}%`}</strong>
        </div>
        <div className="nd-progress-compare">
          <span>Physical</span>
          <div className="nd-compare-track"><div className="nd-compare-fill nd-compare-current" style={{ width: `${currentWidth}%` }} /></div>
          <strong>{current === null ? "N/A" : `${current}%`}</strong>
        </div>
        {current !== null && expected !== null && (
          <div className={`nd-progress-gap ${current < expected ? "nd-gap-alert" : "nd-gap-good"}`}>
            <span>Current position</span>
            <strong>{current >= expected ? "At / above expected" : `${(expected - current).toFixed(1)} percentage points below expected`}</strong>
          </div>
        )}
      </div>

      {points.length > 1 && (
        <div className="nd-sparkline-wrap">
          <svg viewBox="0 0 640 90" preserveAspectRatio="none" role="img" aria-label="Historical physical progress trajectory" className="nd-sparkline">
            <line x1="0" y1="75" x2="640" y2="75" className="nd-spark-grid" />
            <line x1="0" y1="45" x2="640" y2="45" className="nd-spark-grid" />
            <line x1="0" y1="15" x2="640" y2="15" className="nd-spark-grid" />
            <polyline
              points={points.map((point, index) => {
                const x = points.length === 1 ? 320 : (index / (points.length - 1)) * 640;
                const value = Math.min(100, Math.max(0, point.value));
                const y = 75 - (value / 100) * 60;
                return `${x},${y}`;
              }).join(" ")}
              className="nd-spark-line"
              fill="none"
            />
            {points.map((point, index) => {
              const x = points.length === 1 ? 320 : (index / (points.length - 1)) * 640;
              const value = Math.min(100, Math.max(0, point.value));
              const y = 75 - (value / 100) * 60;
              return <circle key={`${point.date}-${index}`} cx={x} cy={y} r="3" className="nd-spark-point" />;
            })}
          </svg>
          <div className="nd-spark-caption">
            <span>{dateLabel(points[0].date)}</span>
            <span>{points.length} reported observations</span>
            <span>{dateLabel(points[points.length - 1].date)}</span>
          </div>
        </div>
      )}
    </DiagramFrame>
  );
}

function RiskSignalDiagram({
  score,
  factors,
}: {
  score: number | null;
  factors: ApiRiskAssessment["factors"];
}) {
  const available = factors.filter((factor) => factor.available && factor.factor !== "data_coverage");
  if (score === null && available.length === 0) return null;

  const severityWeight: Record<string, number> = {
    critical: 100,
    high: 80,
    medium: 55,
    low: 25,
  };

  return (
    <DiagramFrame
      eyebrow="RISK SIGNAL MAP"
      title="Assessment structure"
      description="Available factors are shown by reported severity; no new risk score is calculated here."
    >
      <div className="nd-risk-map">
        <div className="nd-risk-score-ring" aria-label={score === null ? "Risk score unavailable" : `Risk score ${score}`}>
          <div>
            <span>RISK</span>
            <strong>{score === null ? "—" : Math.round(score)}</strong>
            <small>/ 100</small>
          </div>
        </div>
        <div className="nd-risk-map-list">
          {available.length === 0 ? (
            <div className="nd-map-empty">No scored risk factors available.</div>
          ) : available.slice(0, 6).map((factor) => {
            const severity = String(factor.severity ?? "neutral").toLowerCase();
            const width = severityWeight[severity] ?? 20;
            return (
              <div className="nd-map-row" key={factor.factor}>
                <div>
                  <span>{factor.factor.replaceAll("_", " ")}</span>
                  <strong>{factor.severity || "Not available"}</strong>
                </div>
                <div className="nd-map-track"><div className={`nd-map-fill nd-map-${severity}`} style={{ width: `${width}%` }} /></div>
              </div>
            );
          })}
        </div>
      </div>
    </DiagramFrame>
  );
}

/* ================================================================
   STYLES
================================================================ */

const styles = `
  :root {
    --nd-bg: #fcfbf8;
    --nd-card: #ffffff;
    --nd-card-soft: #f5f2ec;
    --nd-text: #171717;
    --nd-muted: #737373;
    --nd-light: #a1a1a1;
    --nd-line: #dedad2;
    --nd-line-light: #ebe7e0;
    --nd-dark: #171717;
  }

  * {
    box-sizing: border-box;
  }

  .nd-page {
    min-height: 100vh;
    background: var(--nd-bg);
    color: var(--nd-text);
  }

  .nd-reveal {
    animation: nd-section-reveal 720ms cubic-bezier(.22,1,.36,1) both;
  }

  .nd-reveal:nth-of-type(2) { animation-delay: 70ms; }
  .nd-reveal:nth-of-type(3) { animation-delay: 120ms; }
  .nd-reveal:nth-of-type(4) { animation-delay: 170ms; }

  @keyframes nd-section-reveal {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .nd-project-hero {
    animation: nd-hero-in 760ms cubic-bezier(.22,1,.36,1) both;
  }

  @keyframes nd-hero-in {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .nd-metric-card,
  .nd-risk-factor-card,
  .nd-warning-card,
  .nd-prediction-card,
  .nd-action-card,
  .nd-info-item {
    transition: border-color 220ms ease, background-color 220ms ease, transform 220ms ease;
  }

  .nd-metric-card:hover,
  .nd-risk-factor-card:hover,
  .nd-warning-card:hover,
  .nd-prediction-card:hover,
  .nd-action-card:hover {
    border-color: #cfc8bf;
    transform: translateY(-2px);
  }

  .nd-diagram-frame {
    margin-top: 16px;
    padding: 20px;
    border: 1px solid var(--nd-line);
    background: rgba(255,255,255,.78);
    overflow: hidden;
  }

  .nd-diagram-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--nd-line-light);
  }

  .nd-diagram-heading span:first-child {
    display: block;
    color: #9a6b50;
    font-size: 9px;
    font-weight: 750;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .nd-diagram-heading h3 {
    margin: 5px 0 0;
    font-size: 15px;
    font-weight: 650;
    letter-spacing: -.015em;
  }

  .nd-diagram-heading p {
    margin: 5px 0 0;
    color: #858585;
    font-size: 10px;
  }

  .nd-diagram-index {
    padding: 5px 7px;
    border: 1px solid #ded8d0;
    color: #8c857d;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .08em;
    white-space: nowrap;
  }

  .nd-cost-diagram {
    display: grid;
    gap: 16px;
    padding-top: 19px;
  }

  .nd-cost-row {
    animation: nd-bar-in 680ms cubic-bezier(.22,1,.36,1) var(--nd-delay) both;
  }

  @keyframes nd-bar-in {
    from { opacity: 0; transform: translateX(-12px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .nd-cost-row-label {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 7px;
  }

  .nd-cost-row-label span { color: #777; font-size: 10px; font-weight: 650; }
  .nd-cost-row-label strong { color: #333; font-size: 10px; font-weight: 650; }

  .nd-cost-track, .nd-compare-track, .nd-map-track {
    height: 8px;
    overflow: hidden;
    background: #ece9e4;
  }

  .nd-cost-bar, .nd-compare-fill, .nd-map-fill {
    height: 100%;
    transform-origin: left center;
    animation: nd-fill-in 900ms cubic-bezier(.22,1,.36,1) both;
  }

  .nd-cost-bar-base { background: #8d8a84; }
  .nd-cost-bar-current { background: #242424; }
  .nd-cost-bar-spend { background: #b9b3aa; }

  @keyframes nd-fill-in { from { transform: scaleX(0); } to { transform: scaleX(1); } }

  .nd-progress-diagram { padding-top: 18px; }

  .nd-progress-axis {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    margin-left: 82px;
    color: #aaa39b;
    font-size: 8px;
  }
  .nd-progress-axis span:not(:first-child) { text-align: right; }

  .nd-progress-compare {
    display: grid;
    grid-template-columns: 70px 1fr 52px;
    align-items: center;
    gap: 12px;
    margin-top: 11px;
  }
  .nd-progress-compare > span { color: #777; font-size: 10px; font-weight: 650; }
  .nd-progress-compare > strong { color: #333; font-size: 10px; text-align: right; }
  .nd-compare-expected { background: #aaa59d; }
  .nd-compare-current { background: #202020; }

  .nd-progress-gap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 15px;
    padding: 10px 12px;
    border-left: 2px solid #777;
    background: #f7f5f1;
  }
  .nd-progress-gap span { color: #8a847d; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }
  .nd-progress-gap strong { font-size: 10px; }
  .nd-gap-alert { border-left-color: #f26a21; }
  .nd-gap-alert strong { color: #a04a1c; }
  .nd-gap-good { border-left-color: #3b7a57; }
  .nd-gap-good strong { color: #3b7a57; }

  .nd-sparkline-wrap { margin-top: 18px; padding-top: 15px; border-top: 1px solid var(--nd-line-light); }
  .nd-sparkline { width: 100%; height: 90px; display: block; }
  .nd-spark-grid { stroke: #e9e5df; stroke-width: 1; }
  .nd-spark-line { stroke: #242424; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; animation: nd-draw-line 1.1s ease both; }
  .nd-spark-point { fill: #fff; stroke: #242424; stroke-width: 2; animation: nd-point-in 450ms ease both; }
  @keyframes nd-draw-line { from { stroke-dasharray: 1000; stroke-dashoffset: 1000; } to { stroke-dasharray: 1000; stroke-dashoffset: 0; } }
  @keyframes nd-point-in { from { opacity: 0; } to { opacity: 1; } }
  .nd-spark-caption { display: flex; justify-content: space-between; color: #9a958e; font-size: 8px; }

  .nd-risk-map {
    display: grid;
    grid-template-columns: 160px 1fr;
    align-items: center;
    gap: 28px;
    padding-top: 20px;
  }

  .nd-risk-score-ring {
    width: 132px;
    height: 132px;
    margin: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 7px solid #ece8e1;
    border-top-color: #f26a21;
    border-right-color: #f26a21;
    border-radius: 50%;
    animation: nd-ring-in 900ms cubic-bezier(.22,1,.36,1) both;
  }
  @keyframes nd-ring-in { from { transform: rotate(-40deg) scale(.86); opacity: .3; } to { transform: rotate(0) scale(1); opacity: 1; } }
  .nd-risk-score-ring > div { text-align: center; }
  .nd-risk-score-ring span, .nd-risk-score-ring small { display: block; color: #999; font-size: 8px; font-weight: 700; letter-spacing: .08em; }
  .nd-risk-score-ring strong { display: inline-block; margin: 4px 2px 0; font-size: 31px; font-weight: 680; letter-spacing: -.05em; }
  .nd-risk-map-list { display: grid; gap: 12px; }
  .nd-map-row > div:first-child { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 6px; }
  .nd-map-row span { color: #666; font-size: 9px; text-transform: capitalize; }
  .nd-map-row strong { color: #555; font-size: 8px; text-transform: uppercase; letter-spacing: .05em; }
  .nd-map-low { background: #3b7a57; }
  .nd-map-medium { background: #a88745; }
  .nd-map-high, .nd-map-critical { background: #f26a21; }
  .nd-map-neutral { background: #aaa; }
  .nd-map-empty { color: #999; font-size: 10px; padding: 15px 0; }

  .nd-container {
    width: min(1440px, calc(100% - 48px));
    margin: 0 auto;
  }

  /* ============================================================
     HERO
  ============================================================ */

  .nd-project-hero {
    background: #fff;
    border-bottom: 1px solid var(--nd-line);
    padding: 24px 0 0;
  }

  .nd-back-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #666;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
  }

  .nd-back-link:hover {
    color: #111;
  }

  .nd-dossier-header-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .nd-ai-launcher {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid #d8d2ca;
    border-radius: 6px;
    background: #fffaf5;
    color: #8b421e;
    cursor: pointer;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .08em;
  }

  .nd-ai-launcher:hover,
  .nd-ai-launcher:focus-visible {
    border-color: #b75a2b;
    outline: 2px solid rgba(183, 90, 43, .18);
    outline-offset: 2px;
  }

  .nd-assistant-backdrop {
    position: fixed;
    z-index: 80;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    background: rgba(23, 23, 23, .22);
    cursor: default;
  }

  .nd-assistant-drawer {
    position: fixed;
    z-index: 81;
    top: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    width: min(420px, 100vw);
    height: 100dvh;
    border-left: 1px solid #d9d2ca;
    background: #fffdf9;
    color: #292521;
    box-shadow: none;
    animation: nd-assistant-drawer-in .2s ease-out both;
  }

  .nd-assistant-drawer-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 22px 20px 18px;
    border-bottom: 1px solid #e4ddd5;
  }

  .nd-assistant-drawer-header h2 {
    margin: 5px 0 0;
    font-family: "Times New Roman", Times, serif;
    font-size: 21px;
    font-weight: 600;
  }

  .nd-panel-label {
    margin: 0;
    color: #a4562b;
    font-size: 9px;
    font-weight: 750;
    letter-spacing: .11em;
    text-transform: uppercase;
  }

  .nd-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid #d8d2ca;
    border-radius: 5px;
    background: #fff;
    color: #5c554e;
    cursor: pointer;
    font-size: 23px;
    line-height: 1;
  }

  .nd-icon-button:hover,
  .nd-icon-button:focus-visible {
    border-color: #b75a2b;
    color: #8b421e;
    outline: 2px solid rgba(183, 90, 43, .18);
    outline-offset: 2px;
  }

  .nd-assistant-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 18px 20px 26px;
  }

  .nd-assistant-suggestions {
    display: grid;
    gap: 7px;
    margin-bottom: 16px;
  }

  .nd-secondary-button {
    width: 100%;
    padding: 9px 10px;
    border: 1px solid #ddd5cc;
    border-radius: 5px;
    background: #fff;
    color: #5b5148;
    cursor: pointer;
    font-size: 11px;
    text-align: left;
  }

  .nd-secondary-button:hover,
  .nd-secondary-button:focus-visible {
    border-color: #bd6a3a;
    color: #8b421e;
    outline: 2px solid rgba(183, 90, 43, .15);
    outline-offset: 1px;
  }

  .nd-secondary-button:disabled,
  .nd-primary-button:disabled,
  .nd-input:disabled {
    cursor: not-allowed;
    opacity: .55;
  }

  .nd-assistant-form {
    display: flex;
    gap: 8px;
    align-items: stretch;
    padding-bottom: 18px;
    border-bottom: 1px solid #e4ddd5;
  }

  .nd-assistant-form .nd-input {
    min-width: 0;
    flex: 1;
  }

  .nd-assistant-form .nd-primary-button {
    flex: 0 0 auto;
    border: 0;
    cursor: pointer;
  }

  .nd-assistant-loading,
  .nd-assistant-unavailable,
  .nd-assistant-response {
    margin-top: 18px;
    padding: 14px;
    border: 1px solid #e4ddd5;
    background: #fff;
    font-size: 12px;
    line-height: 1.55;
  }

  .nd-assistant-loading {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #756b62;
  }

  .nd-assistant-loading .nd-loading-spinner {
    width: 16px;
    height: 16px;
    margin: 0;
    border-width: 2px;
  }

  .nd-assistant-unavailable {
    border-color: #ead8c9;
    background: #fffaf5;
  }

  .nd-assistant-unavailable strong {
    color: #8b421e;
    font-size: 11px;
  }

  .nd-assistant-unavailable p,
  .nd-assistant-response p {
    margin: 6px 0 0;
  }

  .nd-assistant-response ul {
    margin: 7px 0 16px;
    padding-left: 18px;
  }

  .nd-assistant-response .nd-panel-label:not(:first-child) {
    margin-top: 16px;
  }

  .nd-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes nd-assistant-drawer-in {
    from { transform: translateX(18px); opacity: .7; }
    to { transform: translateX(0); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .nd-assistant-drawer,
    .nd-project-hero,
    .nd-reveal,
    .nd-cost-row,
    .nd-cost-bar,
    .nd-compare-fill,
    .nd-spark-line,
    .nd-spark-point,
    .nd-risk-score-ring {
      animation: none !important;
      transition: none !important;
    }
  }

  .nd-hero-layout {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 40px;
    padding: 30px 0 28px;
  }

  .nd-hero-main {
    min-width: 0;
  }

  .nd-record-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    color: #777;
    font-size: 10px;
    font-weight: 650;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .nd-hero-main h1 {
    max-width: 850px;
    margin: 0;
    color: #171717;
    font-size: clamp(27px, 3vw, 42px);
    line-height: 1.08;
    font-weight: 680;
    letter-spacing: -.035em;
  }

  .nd-hero-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 9px;
    margin: 11px 0 0;
    color: #777;
    font-size: 13px;
  }

  .nd-hero-meta b {
    color: #c0c0c0;
    font-weight: 400;
  }

  .nd-identity-card {
    width: 260px;
    flex: 0 0 260px;
    padding: 16px;
    border: 1px solid var(--nd-line);
    border-radius: 10px;
    background: #fafafa;
  }

  .nd-identity-card span {
    display: block;
    margin-bottom: 6px;
    color: #8a8a8a;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .09em;
  }

  .nd-identity-card strong {
    display: block;
    overflow: hidden;
    color: #222;
    font-size: 14px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nd-identity-card small {
    display: block;
    margin-top: 6px;
    color: #999;
    font-size: 10px;
  }

  .nd-hero-metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-top: 1px solid var(--nd-line);
  }

  .nd-hero-metrics > div {
    min-height: 76px;
    padding: 14px 20px;
    border-right: 1px solid var(--nd-line);
  }

  .nd-hero-metrics > div:first-child {
    padding-left: 0;
  }

  .nd-hero-metrics > div:last-child {
    border-right: 0;
  }

  .nd-hero-metrics span {
    display: block;
    margin-bottom: 6px;
    color: #888;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
  }

  .nd-hero-metrics strong {
    color: #222;
    font-size: 16px;
    font-weight: 650;
  }

  /* ============================================================
     SECTIONS
  ============================================================ */

  .nd-section {
    padding: 38px 0;
  }

  .nd-section-soft {
    background: #f1f3f5;
    border-top: 1px solid #e9eaec;
    border-bottom: 1px solid #e9eaec;
  }

  .nd-section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .nd-section-heading-left {
    display: flex;
    align-items: flex-start;
    gap: 13px;
  }

  .nd-section-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 27px;
    height: 27px;
    flex: 0 0 27px;
    border: 1px solid #dcdcdc;
    border-radius: 7px;
    background: #fff;
    color: #555;
    font-size: 10px;
    font-weight: 700;
  }

  .nd-section-heading h2 {
    margin: 0;
    color: #222;
    font-size: 19px;
    font-weight: 650;
    letter-spacing: -.02em;
  }

  .nd-section-heading p {
    margin: 4px 0 0;
    color: #858585;
    font-size: 11px;
  }

  /* ============================================================
     INFO GRID
  ============================================================ */

  .nd-info-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border: 1px solid var(--nd-line);
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
  }

  .nd-info-item {
    min-height: 86px;
    padding: 15px 17px;
    border-right: 1px solid var(--nd-line);
    border-bottom: 1px solid var(--nd-line);
  }

  .nd-info-item:nth-child(4n) {
    border-right: 0;
  }

  .nd-info-item:nth-last-child(-n + 4) {
    border-bottom: 0;
  }

  .nd-info-item span {
    display: block;
    margin-bottom: 8px;
    color: #8a8a8a;
    font-size: 10px;
    font-weight: 600;
  }

  .nd-info-item strong {
    display: block;
    overflow: hidden;
    color: #282828;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 600;
    text-overflow: ellipsis;
  }

  /* ============================================================
     METRICS
  ============================================================ */

  .nd-metrics-grid,
  .nd-intelligence-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .nd-metric-card {
    min-height: 130px;
    padding: 17px;
    border: 1px solid var(--nd-line);
    border-radius: 10px;
    background: #fff;
  }

  .nd-metric-icon {
    width: 31px;
    height: 31px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 13px;
    border-radius: 7px;
    background: #f1f1f1;
    color: #555;
  }

  .nd-metric-content span {
    display: block;
    color: #858585;
    font-size: 10px;
    font-weight: 600;
  }

  .nd-metric-content strong {
    display: block;
    margin-top: 5px;
    color: #222;
    font-size: 18px;
    font-weight: 650;
    letter-spacing: -.02em;
  }

  .nd-metric-content small {
    display: block;
    margin-top: 5px;
    color: #999;
    font-size: 10px;
  }

  /* ============================================================
     SCHEDULE
  ============================================================ */

  .nd-schedule-layout {
    display: grid;
    grid-template-columns: 1.5fr .8fr;
    gap: 14px;
  }

  .nd-progress-card {
    padding: 20px;
    border: 1px solid var(--nd-line);
    border-radius: 10px;
    background: #fff;
  }

  .nd-progress-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .nd-progress-header > div span {
    display: block;
    color: #858585;
    font-size: 10px;
    font-weight: 600;
  }

  .nd-progress-header strong {
    display: block;
    margin-top: 4px;
    font-size: 28px;
    font-weight: 680;
    letter-spacing: -.04em;
  }

  .nd-progress-header > svg {
    color: #999;
  }

  .nd-large-progress-track {
    height: 8px;
    overflow: hidden;
    margin-top: 28px;
    border-radius: 999px;
    background: #e9e9e9;
  }

  .nd-large-progress-bar {
    height: 100%;
    border-radius: inherit;
    background: #171717;
    transition: width .3s ease;
  }

  .nd-progress-comparison {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 9px;
    color: #888;
    font-size: 10px;
  }

  /* ============================================================
     RISK
  ============================================================ */

  .nd-risk-summary {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    border: 1px solid var(--nd-line);
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
  }

  .nd-risk-main,
  .nd-risk-stat {
    padding: 20px;
  }

  .nd-risk-main {
    border-right: 1px solid var(--nd-line);
  }

  .nd-risk-stat {
    border-right: 1px solid var(--nd-line);
  }

  .nd-risk-stat:last-child {
    border-right: 0;
  }

  .nd-risk-main-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    color: #777;
    font-size: 10px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: .06em;
  }

  .nd-risk-main-top svg {
    color: #888;
  }

  .nd-risk-main > strong {
    display: inline-block;
    font-size: 19px;
  }

  .nd-risk-main p {
    max-width: 700px;
    margin: 11px 0 0;
    color: #777;
    font-size: 11px;
    line-height: 1.6;
  }

  .nd-risk-stat span {
    display: block;
    color: #888;
    font-size: 10px;
    font-weight: 600;
  }

  .nd-risk-stat strong {
    display: block;
    margin-top: 8px;
    color: #222;
    font-size: 24px;
    font-weight: 680;
  }

  .nd-risk-stat small {
    display: block;
    margin-top: 4px;
    color: #999;
    font-size: 10px;
  }

  .nd-risk-level {
    font-weight: 700 !important;
  }

  .nd-risk-low {
    color: #3d6948 !important;
  }

  .nd-risk-medium {
    color: #8a641b !important;
  }

  .nd-risk-high,
  .nd-risk-critical {
    color: #a33a32 !important;
  }

  .nd-risk-neutral {
    color: #777 !important;
  }

  .nd-subsection {
    margin-top: 26px;
  }

  .nd-subsection-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .nd-subsection-heading h3 {
    margin: 0;
    color: #292929;
    font-size: 13px;
    font-weight: 650;
  }

  .nd-subsection-heading p {
    margin: 3px 0 0;
    color: #888;
    font-size: 10px;
  }

  .nd-count-badge {
    padding: 5px 9px;
    border: 1px solid var(--nd-line);
    border-radius: 999px;
    background: #fff;
    color: #666;
    font-size: 10px;
    font-weight: 650;
  }

  .nd-risk-factor-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .nd-risk-factor-card {
    padding: 15px;
    border: 1px solid var(--nd-line);
    border-radius: 9px;
    background: #fff;
  }

  .nd-factor-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .nd-factor-top strong {
    color: #333;
    font-size: 11px;
    text-transform: capitalize;
  }

  .nd-factor-value {
    margin-top: 15px;
    color: #222;
    font-size: 18px;
    font-weight: 650;
  }

  .nd-risk-factor-card p {
    margin: 6px 0 0;
    color: #888;
    font-size: 10px;
    line-height: 1.5;
  }

  .nd-severity {
    display: inline-flex;
    align-items: center;
    padding: 4px 7px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 700;
    white-space: nowrap;
  }

  .nd-severity-low {
    background: #eef5ef;
    color: #4c7055;
  }

  .nd-severity-medium {
    background: #faf4e4;
    color: #87641e;
  }

  .nd-severity-high,
  .nd-severity-critical {
    background: #f9e9e7;
    color: #a23b33;
  }

  .nd-severity-neutral {
    background: #f1f1f1;
    color: #777;
  }

  .nd-unavailable-card {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 17px;
    border: 1px dashed #d8d8d8;
    border-radius: 9px;
    background: #fafafa;
  }

  .nd-unavailable-card strong {
    display: block;
    color: #444;
    font-size: 11px;
  }

  .nd-unavailable-card p {
    margin: 4px 0 0;
    color: #888;
    font-size: 10px;
    line-height: 1.5;
  }

  /* ============================================================
     WARNINGS
  ============================================================ */

  .nd-warning-list {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .nd-warning-card {
    padding: 16px;
    border: 1px solid var(--nd-line);
    border-radius: 9px;
    background: #fff;
  }

  .nd-warning-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .nd-warning-top > svg {
    color: #999;
  }

  .nd-warning-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .nd-source-badge,
  .nd-warning-type {
    padding: 4px 7px;
    border: 1px solid #e4e4e4;
    border-radius: 999px;
    color: #777;
    background: #fafafa;
    font-size: 9px;
    font-weight: 600;
  }

  .nd-warning-content {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 25px;
    margin-top: 14px;
  }

  .nd-warning-content h4 {
    margin: 0;
    color: #292929;
    font-size: 13px;
    font-weight: 650;
  }

  .nd-warning-content p {
    margin: 6px 0 0;
    color: #777;
    font-size: 11px;
    line-height: 1.55;
  }

  .nd-recommended-check {
    padding-left: 16px;
    border-left: 1px solid var(--nd-line);
  }

  .nd-recommended-check span {
    display: block;
    color: #999;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
  }

  .nd-recommended-check strong {
    display: block;
    margin-top: 6px;
    color: #444;
    font-size: 11px;
    line-height: 1.5;
  }

  /* ============================================================
     PREDICTIONS
  ============================================================ */

  .nd-prediction-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 13px;
  }

  .nd-prediction-card {
    padding: 20px;
    border: 1px solid var(--nd-line);
    border-radius: 10px;
    background: #fff;
  }

  .nd-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
  }

  .nd-card-header span {
    display: block;
    color: #8a8a8a;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .07em;
    text-transform: uppercase;
  }

  .nd-card-header h3 {
    margin: 5px 0 0;
    color: #292929;
    font-size: 14px;
    font-weight: 650;
  }

  .nd-card-header > svg {
    color: #888;
  }

  .nd-prediction-result {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-top: 25px;
  }

  .nd-prediction-result strong {
    color: #222;
    font-size: 20px;
    font-weight: 680;
  }

  .nd-prediction-result span {
    color: #777;
    font-size: 10px;
  }

  .nd-prediction-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  .nd-prediction-meta span {
    padding: 5px 8px;
    border-radius: 5px;
    background: #f3f3f3;
    color: #777;
    font-size: 9px;
  }

  .nd-coverage-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 14px;
    padding-top: 13px;
    border-top: 1px solid var(--nd-line-light);
  }

  .nd-coverage-row span {
    color: #888;
    font-size: 10px;
  }

  .nd-coverage-row strong {
    color: #444;
    font-size: 11px;
  }

  .nd-model-explanation {
    margin-top: 18px;
    padding-top: 17px;
    border-top: 1px solid var(--nd-line);
  }

  .nd-model-explanation h4 {
    margin: 0;
    color: #444;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
  }

  .nd-model-explanation > p {
    margin: 7px 0 0;
    color: #777;
    font-size: 10px;
    line-height: 1.55;
  }

  .nd-signal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 16px;
  }

  .nd-signal-list > span {
    display: block;
    margin-bottom: 6px;
    color: #777;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .05em;
  }

  .nd-signal {
    padding: 8px 0;
    border-bottom: 1px solid var(--nd-line-light);
  }

  .nd-signal > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .nd-signal strong {
    color: #444;
    font-size: 10px;
    text-transform: capitalize;
  }

  .nd-signal b {
    font-size: 10px;
  }

  .nd-contribution-positive {
    color: #50705a;
  }

  .nd-contribution-negative {
    color: #777;
  }

  .nd-signal small {
    display: block;
    margin-top: 3px;
    color: #999;
    font-size: 9px;
  }

  .nd-no-signal {
    margin: 0;
    color: #999;
    font-size: 10px;
  }

  .nd-prediction-unavailable {
    margin-top: 25px;
    padding: 18px;
    border: 1px dashed #d9d9d9;
    border-radius: 8px;
    background: #fafafa;
  }

  .nd-unavailable-icon {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
    border-radius: 7px;
    background: #ededed;
    color: #777;
  }

  .nd-prediction-unavailable > strong {
    display: block;
    color: #444;
    font-size: 11px;
  }

  .nd-prediction-unavailable p {
    max-width: 500px;
    margin: 5px 0 0;
    color: #888;
    font-size: 10px;
    line-height: 1.55;
  }

  /* ============================================================
     ACTIONS
  ============================================================ */

  .nd-actions-header {
    margin-bottom: 13px;
  }

  .nd-action-summary {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: #777;
    font-size: 10px;
  }

  .nd-action-summary svg {
    color: #777;
  }

  .nd-actions-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .nd-action-card {
    padding: 18px;
    border: 1px solid var(--nd-line);
    border-radius: 10px;
    background: #fff;
  }

  .nd-action-title-wrap {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
  }

  .nd-action-card h3 {
    margin: 12px 0 0;
    color: #242424;
    font-size: 14px;
    font-weight: 650;
  }

  .nd-action-reason {
    margin: 7px 0 0;
    color: #666;
    font-size: 11px;
    line-height: 1.55;
  }

  .nd-action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
    margin-top: 14px;
    padding-top: 13px;
    border-top: 1px solid var(--nd-line-light);
  }

  .nd-action-grid span {
    display: block;
    color: #999;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .05em;
    text-transform: uppercase;
  }

  .nd-action-grid p {
    margin: 5px 0 0;
    color: #777;
    font-size: 10px;
    line-height: 1.5;
  }

  /* ============================================================
     HISTORY
  ============================================================ */

  .nd-history-layout {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .nd-history-chart-card {
    padding: 20px;
    border: 1px solid var(--nd-line);
    border-radius: 10px;
    background: #fff;
  }

  .nd-bar-chart {
    height: 230px;
    display: flex;
    align-items: flex-end;
    gap: 10px;
    margin-top: 25px;
    padding: 0 5px;
    border-bottom: 1px solid #ddd;
  }

  .nd-bar-column {
    height: 100%;
    flex: 1;
    min-width: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
  }

  .nd-bar-value {
    color: #777;
    font-size: 9px;
  }

  .nd-bar-track {
    width: min(42px, 75%);
    height: 185px;
    display: flex;
    align-items: flex-end;
    overflow: hidden;
    border-radius: 5px 5px 0 0;
    background: #eeeeee;
  }

  .nd-bar {
    width: 100%;
    border-radius: 5px 5px 0 0;
    background: #222;
    transition: height .25s ease;
  }

  .nd-chart-labels {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }

  .nd-chart-labels span {
    flex: 1;
    min-width: 20px;
    overflow: hidden;
    color: #999;
    font-size: 8px;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nd-chart-empty {
    padding: 50px 0;
    color: #999;
    font-size: 11px;
    text-align: center;
  }

  .nd-history-tables {
    display: flex;
    flex-direction: column;
    gap: 25px;
  }

  .nd-history-block {
    min-width: 0;
  }

  .nd-table-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .nd-table-heading h3 {
    margin: 0;
    color: #333;
    font-size: 13px;
    font-weight: 650;
  }

  .nd-table-heading span {
    color: #999;
    font-size: 9px;
  }

  .nd-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--nd-line);
    border-radius: 9px;
    background: #fff;
  }

  .nd-history-table {
    width: 100%;
    min-width: 750px;
    border-collapse: collapse;
    font-size: 10px;
  }

  .nd-history-table th {
    padding: 10px 12px;
    border-bottom: 1px solid var(--nd-line);
    background: #fafafa;
    color: #777;
    font-size: 9px;
    font-weight: 700;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: .04em;
    white-space: nowrap;
  }

  .nd-history-table td {
    padding: 11px 12px;
    border-bottom: 1px solid var(--nd-line-light);
    color: #777;
    white-space: nowrap;
  }

  .nd-history-table tr:last-child td {
    border-bottom: 0;
  }

  .nd-table-strong {
    color: #333 !important;
    font-weight: 650;
  }

  /* ============================================================
     STATE
  ============================================================ */

  .nd-state-container {
    min-height: 70vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nd-state-card {
    width: min(430px, 100%);
    padding: 35px;
    border: 1px solid var(--nd-line);
    border-radius: 11px;
    background: #fff;
    text-align: center;
  }

  .nd-state-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 13px;
    border-radius: 10px;
    background: #f1f1f1;
    color: #777;
  }

  .nd-error-icon {
    background: #faeeee;
    color: #a33a32;
  }

  .nd-state-card h2 {
    margin: 0;
    color: #292929;
    font-size: 16px;
    font-weight: 650;
  }

  .nd-state-card p {
    margin: 7px 0 18px;
    color: #888;
    font-size: 11px;
    line-height: 1.55;
  }

  .nd-primary-button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 36px;
    padding: 0 13px;
    border-radius: 7px;
    background: #171717;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
  }

  .nd-loading-spinner {
    width: 28px;
    height: 28px;
    margin: 0 auto 14px;
    border: 3px solid #e5e5e5;
    border-top-color: #222;
    border-radius: 50%;
    animation: nd-spin .7s linear infinite;
  }

  @keyframes nd-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ============================================================
     RESPONSIVE
  ============================================================ */

  @media (max-width: 1100px) {
    .nd-info-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .nd-info-item:nth-child(4n) {
      border-right: 1px solid var(--nd-line);
    }

    .nd-info-item:nth-child(2n) {
      border-right: 0;
    }

    .nd-info-item:nth-last-child(-n + 4) {
      border-bottom: 1px solid var(--nd-line);
    }

    .nd-info-item:nth-last-child(-n + 2) {
      border-bottom: 0;
    }

    .nd-metrics-grid,
    .nd-intelligence-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .nd-schedule-layout {
      grid-template-columns: 1fr;
    }

    .nd-risk-factor-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 800px) {
    .nd-container {
      width: min(100% - 24px, 1440px);
    }

    .nd-hero-layout {
      align-items: stretch;
      flex-direction: column;
      gap: 20px;
    }

    .nd-identity-card {
      width: 100%;
      flex-basis: auto;
    }

    .nd-hero-metrics {
      grid-template-columns: repeat(2, 1fr);
    }

    .nd-hero-metrics > div {
      border-bottom: 1px solid var(--nd-line);
    }

    .nd-hero-metrics > div:nth-child(2) {
      border-right: 0;
    }

    .nd-hero-metrics > div:first-child {
      padding-left: 12px;
    }

    .nd-prediction-grid,
    .nd-risk-summary {
      grid-template-columns: 1fr;
    }

    .nd-risk-main,
    .nd-risk-stat {
      border-right: 0;
      border-bottom: 1px solid var(--nd-line);
    }

    .nd-risk-stat:last-child {
      border-bottom: 0;
    }

    .nd-warning-content {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .nd-recommended-check {
      padding-left: 0;
      padding-top: 12px;
      border-left: 0;
      border-top: 1px solid var(--nd-line);
    }

    .nd-signal-grid {
      grid-template-columns: 1fr;
    }

    .nd-action-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }

  @media (max-width: 800px) {
    .nd-risk-map {
      grid-template-columns: 1fr;
      gap: 18px;
    }
    .nd-risk-score-ring {
      width: 112px;
      height: 112px;
    }
    .nd-progress-compare {
      grid-template-columns: 58px 1fr 45px;
      gap: 8px;
    }
  }

  @media (max-width: 600px) {
    .nd-section {
      padding: 27px 0;
    }

    .nd-project-hero {
      padding-top: 18px;
    }

    .nd-hero-main h1 {
      font-size: 25px;
    }

    .nd-hero-meta {
      font-size: 11px;
    }

    .nd-hero-metrics {
      grid-template-columns: 1fr 1fr;
    }

    .nd-hero-metrics > div {
      min-height: 70px;
      padding: 12px;
    }

    .nd-info-grid,
    .nd-metrics-grid,
    .nd-intelligence-grid,
    .nd-risk-factor-grid {
      grid-template-columns: 1fr;
    }

    .nd-info-item,
    .nd-info-item:nth-child(2n),
    .nd-info-item:nth-child(4n) {
      border-right: 0;
      border-bottom: 1px solid var(--nd-line);
    }

    .nd-info-item:last-child {
      border-bottom: 0;
    }

    .nd-metric-card {
      min-height: 115px;
    }

    .nd-progress-comparison {
      flex-direction: column;
      gap: 4px;
    }

    .nd-bar-chart {
      gap: 5px;
    }

    .nd-bar-track {
      width: min(25px, 75%);
    }

    .nd-bar-value {
      font-size: 7px;
    }

    .nd-chart-labels span {
      font-size: 7px;
    }
  }
`;
