"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Database,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  type ApiProject,
  type ApiProjectHistory,
  type ApiProjectIntelligence,
  type ApiCostIntelligenceResponse,
  type ApiRiskAssessment,
  type ApiEarlyWarning,
  type ApiCostRevisionPrediction,
  type ApiScheduleRevisionPrediction,
  type ApiProjectAction,
} from "@/lib/api";

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

const probabilityLabel = (
  value: string | number | null | undefined,
) => {
  const parsed = numeric(value);

  return parsed === null || !Number.isFinite(parsed)
    ? "Not available"
    : `${(parsed * 100).toLocaleString("en-IN", {
        maximumFractionDigits: 1,
      })}%`;
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
  value: string;
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

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);

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

      <main className="nd-page">

        {/* =========================================================
            HERO
        ========================================================= */}

        <section className="nd-project-hero">
          <div className="nd-container">

            <Link
              href="/projects"
              className="nd-back-link"
            >
              <ArrowLeft size={15} />
              Back to Project Register
            </Link>

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

        <section className="nd-section">
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

        <section className="nd-section nd-section-soft">
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
                value={money(
                  project.original_cost,
                )}
                description="Reported value"
              />

              <MetricCard
                icon={<TrendingUp size={18} />}
                label="Latest current cost"
                value={money(
                  project.current_cost,
                )}
                description="Reported value"
              />

              <MetricCard
                icon={<Activity size={18} />}
                label="Cumulative expenditure"
                value={money(
                  project.expenditure,
                )}
                description="Reported value"
              />

              <MetricCard
                icon={<Database size={18} />}
                label="Expenditure position"
                value={
                  expenditurePercentage ===
                  null
                    ? "Not available"
                    : `${expenditurePercentage.toLocaleString(
                        "en-IN",
                      )}%`
                }
                description="Share of latest cost"
              />

            </div>
          </div>
        </section>

        {/* =========================================================
            SCHEDULE
        ========================================================= */}

        <section className="nd-section">
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
          </div>
        </section>

        {/* =========================================================
            RISK
        ========================================================= */}

        <section className="nd-section nd-section-soft">
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
                  {risk.score == null
                    ? "Not available"
                    : risk.score}
                </strong>
                <small>0–100 heuristic score</small>
              </div>

              <div className="nd-risk-stat">
                <span>Data coverage</span>
                <strong>
                  {dataCoverage === null
                    ? "Not available"
                    : `${(
                        dataCoverage * 100
                      ).toLocaleString(
                        "en-IN",
                        {
                          maximumFractionDigits: 1,
                        },
                      )}%`}
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

        <section className="nd-section">
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
                        Probability:{" "}
                        {probabilityLabel(
                          costPrediction.probability,
                        )}
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
                        Probability:{" "}
                        {probabilityLabel(
                          schedulePrediction.probability,
                        )}
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

        <section className="nd-section nd-section-soft">
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
                <MetricCard icon={<Wallet size={18} />} label="Original cost" value={money(costIntelligence.original_cost)} description="Reported original cost" />
                <MetricCard icon={<TrendingUp size={18} />} label="Current / revised cost" value={money(costIntelligence.revised_current_cost)} description="Latest reported cost" />
                <MetricCard icon={<Wallet size={18} />} label="Expenditure" value={money(costIntelligence.expenditure)} description="Cumulative reported expenditure" />
                <MetricCard icon={<TrendingUp size={18} />} label="Current cost overrun" value={money(costIntelligence.current_cost_overrun_amount)} description={costIntelligence.current_cost_overrun_percentage == null ? "Unavailable" : `${numeric(costIntelligence.current_cost_overrun_percentage)?.toLocaleString("en-IN", { maximumFractionDigits: 1 })}% of original cost`} />
                <MetricCard icon={<Activity size={18} />} label="Overrun %" value={costIntelligence.current_cost_overrun_percentage == null ? "Not available" : `${numeric(costIntelligence.current_cost_overrun_percentage)?.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`} description="Current assessment" />
                <MetricCard icon={<TrendingUp size={18} />} label="Above revised cost" value={money(costIntelligence.amount_above_revised_cost)} description={costIntelligence.expenditure_exceeds_revised_cost ? "Expenditure exceeds revised cost" : "Not applicable"} />
              </div>

              <p className="nd-panel-label">PREDICTED</p>
              <div className="nd-prediction-meta">
                <span>Future reported cost revision: {costIntelligence.prediction.availability === "AVAILABLE" ? (costIntelligence.prediction.prediction ? "Revision indicated" : "No revision indicated") : "Insufficient data"}</span>
                <span>Probability {probabilityLabel(costIntelligence.prediction.probability)}</span>
                <span>Cutoff {costIntelligence.prediction.cutoff_reporting_period || "Not available"}</span>
                <span>Model {costIntelligence.prediction.model_version || "Not available"}</span>
                <span>Coverage {featureCoverage == null ? "Not available" : `${(featureCoverage * 100).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`}</span>
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

        <section className="nd-section">
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

        <section className="nd-section nd-section-soft">
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
   STYLES
================================================================ */

const styles = `
  :root {
    --nd-bg: #f6f7f8;
    --nd-card: #ffffff;
    --nd-card-soft: #fafafa;
    --nd-text: #171717;
    --nd-muted: #737373;
    --nd-light: #a1a1a1;
    --nd-line: #e5e7eb;
    --nd-line-light: #eeeeee;
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
