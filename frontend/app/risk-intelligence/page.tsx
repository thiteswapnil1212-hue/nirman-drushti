"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  getRiskSummary,
  type ApiRiskSummaryResponse,
} from "@/lib/api";
import { AnimatedNumber } from "@/components/AnimatedNumber";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const numeric = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const percentage = (
  value: string | number | null | undefined,
) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return null;

  return Math.max(0, Math.min(100, parsed * 100));
};

const levelClass = (level: string | null | undefined) => {
  const normalized = String(level ?? "")
    .toLowerCase()
    .replace(/\s+/g, "-");

  return `nd-risk-level nd-risk-${normalized}`;
};

/* -------------------------------------------------------------------------- */
/* Small UI components                                                        */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  index,
  eyebrow,
  title,
  description,
}: {
  index: string;
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="ri-section-header">
      <div className="ri-section-number">{index}</div>

      <div className="ri-section-copy">
        {eyebrow ? (
          <p className="nd-eyebrow">{eyebrow}</p>
        ) : null}

        <h2>{title}</h2>

        {description ? (
          <p className="ri-section-description">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className={`ri-metric ${accent ? "ri-metric-accent" : ""}`}>
      <p className="nd-label">{label}</p>

      <strong>{value}</strong>

      {note ? <p>{note}</p> : null}
    </div>
  );
}

function DistributionItem({
  level,
  value,
}: {
  level: string;
  value: number | string;
}) {
  const normalized = level.toLowerCase();

  return (
    <div className="ri-distribution-item">
      <div className="ri-distribution-label">
        <span
          className={`ri-distribution-dot nd-risk-${normalized}`}
        />

        <span>{level}</span>
      </div>

      <strong>{value}</strong>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                    */
/* -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <div className="ri-loading">
      <div className="ri-skeleton ri-skeleton-small" />
      <div className="ri-skeleton ri-skeleton-title" />
      <div className="ri-skeleton ri-skeleton-line" />

      <div className="ri-skeleton-grid">
        <div className="ri-skeleton ri-skeleton-card" />
        <div className="ri-skeleton ri-skeleton-card" />
        <div className="ri-skeleton ri-skeleton-card" />
        <div className="ri-skeleton ri-skeleton-card" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function RiskIntelligencePage() {
  const [state, setState] = useState("");
  const [ministry, setMinistry] = useState("");
  const [sector, setSector] = useState("");
  const [agency, setAgency] = useState("");

  const [data, setData] =
    useState<ApiRiskSummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);

      getRiskSummary(
        {
          state,
          ministry,
          sector,
          implementing_agency: agency,
        },
        {
          signal: controller.signal,
        },
      )
        .then((response) => {
          if (!controller.signal.aborted) {
            setData(response);
          }
        })
        .catch((reason) => {
          if (!controller.signal.aborted) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Risk assessment could not be loaded.",
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [agency, ministry, sector, state]);

  const summary = data?.summary;

  const coverage = useMemo(() => {
    if (!summary?.average_data_coverage) {
      return null;
    }

    const value =
      Number(summary.average_data_coverage) * 100;

    return Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : null;
  }, [summary]);

  const totalRiskProjects = useMemo(() => {
    if (!summary) return 0;

    return (
      Number(summary.low_projects || 0) +
      Number(summary.moderate_projects || 0) +
      Number(summary.high_projects || 0) +
      Number(summary.critical_projects || 0)
    );
  }, [summary]);

  return (
    <>
      <main className="ri-page">
        <div className="ri-shell">

          {/* ================================================================ */}
          {/* HERO                                                             */}
          {/* ================================================================ */}

          <section className="ri-hero">
            <div className="ri-hero-top">
              <Link
                href="/projects"
                className="ri-back-link"
              >
                <ArrowRight
                  size={14}
                  style={{ transform: "rotate(180deg)" }}
                />

                Project register
              </Link>

              <div className="ri-record-label">
                Risk intelligence / portfolio record
              </div>
            </div>

            <div className="ri-hero-grid">
              <div>
                <p className="nd-eyebrow">
                  Operational risk assessment / reported evidence
                </p>

                <h1>
                  Attention
                  <br />
                  from evidence.
                </h1>

                <p className="ri-hero-description">
                  Transparent heuristic signals derived from
                  reported cost, schedule, progress and data
                  coverage. This assessment is not a prediction.
                </p>
              </div>

              <aside className="ri-status">
                <p className="nd-eyebrow">
                  Assessment status
                </p>

                <div className="ri-status-main">
                  <span
                    className={`ri-status-indicator ${
                      loading
                        ? "ri-status-loading"
                        : data?.availability === "AVAILABLE"
                          ? "ri-status-available"
                          : "ri-status-unavailable"
                    }`}
                  />

                  <strong>
                    {loading
                      ? "Loading"
                      : data?.availability === "AVAILABLE"
                        ? "Available"
                        : "Data unavailable"}
                  </strong>
                </div>

                <p>
                  Initial operational thresholds are not
                  statistically calibrated.
                </p>
              </aside>
            </div>
          </section>

          {/* ================================================================ */}
          {/* FILTERS                                                          */}
          {/* ================================================================ */}

          <section className="ri-filter-section">
            <div className="ri-filter-header">
              <div>
                <p className="nd-eyebrow">
                  Portfolio scope
                </p>

                <h2>Assessment filters</h2>
              </div>

              {(state || ministry || sector || agency) && (
                <button
                  type="button"
                  className="ri-clear"
                  onClick={() => {
                    setState("");
                    setMinistry("");
                    setSector("");
                    setAgency("");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="ri-filters">
              <label>
                <span>State</span>

                <input
                  className="nd-input"
                  value={state}
                  onChange={(event) =>
                    setState(event.target.value)
                  }
                  placeholder="State"
                />
              </label>

              <label>
                <span>Ministry</span>

                <input
                  className="nd-input"
                  value={ministry}
                  onChange={(event) =>
                    setMinistry(event.target.value)
                  }
                  placeholder="Ministry"
                />
              </label>

              <label>
                <span>Sector</span>

                <input
                  className="nd-input"
                  value={sector}
                  onChange={(event) =>
                    setSector(event.target.value)
                  }
                  placeholder="Sector"
                />
              </label>

              <label>
                <span>Implementing agency</span>

                <input
                  className="nd-input"
                  value={agency}
                  onChange={(event) =>
                    setAgency(event.target.value)
                  }
                  placeholder="Agency"
                />
              </label>
            </div>
          </section>

          {/* ================================================================ */}
          {/* ERROR                                                            */}
          {/* ================================================================ */}

          {error ? (
            <section className="ri-error-section">
              <div className="ri-error">
                <div className="ri-error-icon">
                  <AlertTriangle size={17} />
                </div>

                <div>
                  <strong>
                    Risk assessment unavailable
                  </strong>

                  <p>{error}</p>
                </div>

                <button
                  type="button"
                  className="ri-retry"
                  onClick={() =>
                    window.location.reload()
                  }
                >
                  <RefreshCw size={14} />
                  Retry
                </button>
              </div>
            </section>
          ) : loading && !summary ? (
            <LoadingState />
          ) : summary ? (
            <>
              {/* ============================================================ */}
              {/* PORTFOLIO ASSESSMENT                                         */}
              {/* ============================================================ */}

              <section className="ri-section">
                <SectionHeader
                  index="01"
                  eyebrow="Portfolio assessment"
                  title="Operational risk position"
                  description="Current heuristic classification across projects with sufficient reported inputs."
                />

                <div className="ri-ledger">
                  <MetricBlock
                    label="Projects assessed"
                    value={<AnimatedNumber value={summary.projects_assessed} format={(value) => Math.round(value).toLocaleString("en-IN")} />}
                    note="Assessment available"
                  />

                  <MetricBlock
                    label="High attention"
                    value={<AnimatedNumber value={summary.high_projects} format={(value) => Math.round(value).toLocaleString("en-IN")} />}
                    note="Heuristic level: high"
                    accent
                  />

                  <MetricBlock
                    label="Critical attention"
                    value={<AnimatedNumber value={summary.critical_projects} format={(value) => Math.round(value).toLocaleString("en-IN")} />}
                    note="Heuristic level: critical"
                    accent
                  />

                  <MetricBlock
                    label="Average score"
                    value={<AnimatedNumber value={numeric(summary.average_score)} format={(value) => value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} />}
                    note="Operational score, not probability"
                  />
                </div>

                <div className="ri-distribution">
                  <div className="ri-distribution-heading">
                    <span>Risk distribution</span>

                    <span>
                      {totalRiskProjects.toLocaleString(
                        "en-IN",
                      )}{" "}
                      classified
                    </span>
                  </div>

                  <div className="ri-distribution-grid">
                    <DistributionItem
                      level="Low"
                      value={summary.low_projects}
                    />

                    <DistributionItem
                      level="Moderate"
                      value={summary.moderate_projects}
                    />

                    <DistributionItem
                      level="High"
                      value={summary.high_projects}
                    />

                    <DistributionItem
                      level="Critical"
                      value={summary.critical_projects}
                    />
                  </div>
                </div>

                <div className="ri-coverage">
                  <div>
                    <span>
                      Average data coverage
                    </span>

                    <strong>
                      {coverage === null
                        ? "Not available"
                      : <AnimatedNumber value={coverage} format={(value) => `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`} />}
                    </strong>
                  </div>

                  {coverage !== null ? (
                    <div className="ri-coverage-track">
                      <span
                        style={{
                          width: `${coverage}%`,
                        }}
                      />
                    </div>
                  ) : null}

                  <p>
                    Coverage reflects the availability of
                    assessment inputs and does not itself
                    imply project risk.
                  </p>
                </div>
              </section>

              {/* ============================================================ */}
              {/* TOP PROJECTS                                                 */}
              {/* ============================================================ */}

              <section className="ri-section">
                <SectionHeader
                  index="02"
                  eyebrow="Attention register"
                  title="Top operational attention"
                  description="Projects receiving the highest operational attention within the selected scope."
                />

                {summary.top_projects?.length ? (
                  <div className="ri-table-shell">
                    <div className="ri-table-topline">
                      <span>
                        {summary.top_projects.length}{" "}
                        projects shown
                      </span>

                      <span>
                        Ranked by operational score
                      </span>
                    </div>

                    <div className="nd-table-wrap">
                      <table className="nd-table ri-table">
                        <thead>
                          <tr>
                            <th>Project</th>
                            <th>Score</th>
                            <th>Level</th>
                            <th>Cost pressure</th>
                            <th>Schedule pressure</th>
                            <th>Progress pressure</th>
                            <th>Coverage</th>
                          </tr>
                        </thead>

                        <tbody>
                          {summary.top_projects.map(
                            (project) => {
                              const projectCoverage =
                                percentage(
                                  project.data_coverage,
                                );

                              return (
                                <tr
                                  key={project.project_id}
                                >
                                  <td>
                                    <Link
                                      href={`/projects/${project.project_id}`}
                                      className="ri-project-link"
                                    >
                                      <span>
                                        {
                                          project.project_name
                                        }
                                      </span>

                                      <ArrowRight
                                        size={13}
                                      />
                                    </Link>
                                  </td>

                                  <td className="ri-score">
                                    <AnimatedNumber value={numeric(project.score)} format={(value) => value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} />
                                  </td>

                                  <td>
                                    <span
                                      className={levelClass(
                                        project.level,
                                      )}
                                    >
                                      {project.level}
                                    </span>
                                  </td>

                                  <td>
                                    <AnimatedNumber value={numeric(project.cost_pressure)} format={(value) => value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} />
                                  </td>

                                  <td>
                                    <AnimatedNumber value={numeric(project.schedule_pressure)} format={(value) => value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} />
                                  </td>

                                  <td>
                                    <AnimatedNumber value={numeric(project.progress_pressure)} format={(value) => value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} />
                                  </td>

                                  <td>
                                    {projectCoverage === null
                                      ? "Not available"
                                      : `${projectCoverage.toLocaleString(
                                          "en-IN",
                                          {
                                            maximumFractionDigits:
                                              1,
                                          },
                                        )}%`}
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="ri-unavailable">
                    <div>
                      <strong>
                        Data unavailable
                      </strong>

                      <p>
                        No projects have enough reported
                        inputs for an operational assessment
                        in this scope.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* ============================================================ */}
              {/* METHODOLOGY                                                  */}
              {/* ============================================================ */}

              <section className="ri-section ri-final-section">
                <SectionHeader
                  index="03"
                  eyebrow="Methodology"
                  title="Assessment basis"
                  description="Interpretation limits for the current operational risk layer."
                />

                <div className="ri-methodology">
                  <div className="ri-method-number">
                    03
                  </div>

                  <div className="ri-method-content">
                    <h3>
                      Rule-based assessment only
                    </h3>

                    <p>
                      Scores use transparent initial
                      operational thresholds based on
                      reported project signals. They are not
                      ML predictions, probabilities,
                      confidence estimates, or causal
                      findings.
                    </p>
                  </div>

                  <div className="ri-method-points">
                    <div>
                      <span>01</span>
                      <p>Reported evidence</p>
                    </div>

                    <div>
                      <span>02</span>
                      <p>Operational thresholds</p>
                    </div>

                    <div>
                      <span>03</span>
                      <p>Risk classification</p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="ri-section">
              <div className="ri-unavailable">
                <div>
                  <strong>
                    Assessment data unavailable
                  </strong>

                  <p>
                    No operational risk assessment is
                    available for the current scope.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ================================================================ */}
          {/* FOOTER                                                           */}
          {/* ================================================================ */}

          <footer className="ri-footer">
            <span>
              <strong>Nirman Drushti</strong>{" "}
              / Risk intelligence
            </span>

            <span>
              Reported evidence · Operational assessment
            </span>
          </footer>
        </div>
      </main>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Public+Sans:wght@400;500;600;700&display=swap");

        :root {
          --ri-paper: #fcfbf8;
          --ri-white: #ffffff;
          --ri-linen: #f5f2ec;
          --ri-ink: #171715;
          --ri-muted: #706e68;
          --ri-soft: #9a9790;
          --ri-border: #d9d5cd;
          --ri-border-dark: #bcb7ad;
          --ri-orange: #f26a21;
          --ri-green: #3b7a57;
        }

        .ri-page {
          min-height: 100vh;
          background: var(--ri-paper);
          color: var(--ri-ink);
          font-family: "Public Sans", Arial, sans-serif;
        }

        .ri-shell {
          width: min(1440px, calc(100% - 48px));
          margin: 0 auto;
          padding: 30px 0 50px;
        }

        /* ------------------------------------------------------------------ */
        /* Hero                                                               */
        /* ------------------------------------------------------------------ */

        .ri-hero {
          padding-bottom: 35px;
          border-bottom: 1px solid var(--ri-border-dark);
        }

        .ri-hero-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 58px;
        }

        .ri-back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--ri-muted);
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
        }

        .ri-back-link:hover {
          color: var(--ri-ink);
        }

        .ri-record-label {
          color: var(--ri-soft);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .ri-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 310px;
          gap: 70px;
          align-items: end;
        }

        .ri-hero h1 {
          margin: 7px 0 0;
          font-family: "Newsreader", Georgia, serif;
          font-size: clamp(52px, 7vw, 88px);
          font-weight: 500;
          letter-spacing: -0.045em;
          line-height: 0.87;
        }

        .ri-hero-description {
          max-width: 680px;
          margin: 28px 0 0;
          color: var(--ri-muted);
          font-size: 12px;
          line-height: 1.7;
        }

        .ri-status {
          min-height: 160px;
          padding: 20px;
          background: var(--ri-white);
          border: 1px solid var(--ri-border);
        }

        .ri-status-main {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
        }

        .ri-status-main strong {
          font-family: "Newsreader", Georgia, serif;
          font-size: 27px;
          font-weight: 500;
        }

        .ri-status-indicator {
          width: 8px;
          height: 8px;
          display: inline-block;
        }

        .ri-status-available {
          background: var(--ri-green);
        }

        .ri-status-unavailable {
          background: var(--ri-orange);
        }

        .ri-status-loading {
          background: var(--ri-soft);
          animation: ri-pulse 1s infinite;
        }

        .ri-status p:last-child {
          margin: 16px 0 0;
          padding-top: 13px;
          border-top: 1px solid var(--ri-border);
          color: var(--ri-muted);
          font-size: 10px;
          line-height: 1.6;
        }

        @keyframes ri-pulse {
          50% {
            opacity: 0.35;
          }
        }

        /* ------------------------------------------------------------------ */
        /* Filters                                                            */
        /* ------------------------------------------------------------------ */

        .ri-filter-section {
          padding: 26px 0 28px;
          border-bottom: 1px solid var(--ri-border);
        }

        .ri-filter-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 17px;
        }

        .ri-filter-header h2 {
          margin: 4px 0 0;
          font-family: "Newsreader", Georgia, serif;
          font-size: 24px;
          font-weight: 500;
        }

        .ri-clear {
          border: 0;
          background: transparent;
          color: var(--ri-muted);
          cursor: pointer;
          font-family: inherit;
          font-size: 10px;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .ri-filters {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid var(--ri-border);
          border-left: 1px solid var(--ri-border);
        }

        .ri-filters label {
          display: block;
          padding: 12px 14px 14px;
          border-right: 1px solid var(--ri-border);
          border-bottom: 1px solid var(--ri-border);
          background: var(--ri-white);
        }

        .ri-filters label > span {
          display: block;
          margin-bottom: 7px;
          color: var(--ri-muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .ri-filters .nd-input {
          width: 100%;
          min-height: 34px;
          padding: 0 8px;
          border: 1px solid var(--ri-border);
          border-radius: 0;
          outline: none;
          background: var(--ri-paper);
          color: var(--ri-ink);
          font-family: inherit;
          font-size: 11px;
        }

        .ri-filters .nd-input:focus {
          border-color: var(--ri-ink);
        }

        /* ------------------------------------------------------------------ */
        /* Sections                                                           */
        /* ------------------------------------------------------------------ */

        .ri-section {
          padding: 42px 0;
          border-bottom: 1px solid var(--ri-border);
        }

        .ri-final-section {
          border-bottom: 0;
          padding-bottom: 30px;
        }

        .ri-section-header {
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr);
          gap: 17px;
          margin-bottom: 23px;
        }

        .ri-section-number {
          padding-top: 3px;
          color: var(--ri-soft);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .ri-section-copy h2 {
          margin: 3px 0 0;
          font-family: "Newsreader", Georgia, serif;
          font-size: 32px;
          font-weight: 500;
          letter-spacing: -0.025em;
          line-height: 1;
        }

        .ri-section-description {
          max-width: 620px;
          margin: 8px 0 0;
          color: var(--ri-muted);
          font-size: 11px;
          line-height: 1.6;
        }

        /* ------------------------------------------------------------------ */
        /* Ledger                                                             */
        /* ------------------------------------------------------------------ */

        .ri-ledger {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid var(--ri-border);
          border-left: 1px solid var(--ri-border);
          background: var(--ri-white);
        }

        .ri-metric {
          min-height: 155px;
          padding: 21px;
          border-right: 1px solid var(--ri-border);
          border-bottom: 1px solid var(--ri-border);
        }

        .ri-metric-accent {
          background: var(--ri-linen);
        }

        .ri-metric strong {
          display: block;
          margin-top: 12px;
          font-family: "Newsreader", Georgia, serif;
          font-size: 39px;
          font-weight: 500;
          letter-spacing: -0.03em;
          line-height: 1;
        }

        .ri-metric p:last-child {
          margin: 11px 0 0;
          color: var(--ri-muted);
          font-size: 9px;
          line-height: 1.5;
        }

        .nd-label {
          margin: 0;
          color: var(--ri-muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        /* ------------------------------------------------------------------ */
        /* Distribution                                                       */
        /* ------------------------------------------------------------------ */

        .ri-distribution {
          margin-top: 16px;
          background: var(--ri-white);
          border: 1px solid var(--ri-border);
        }

        .ri-distribution-heading {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 12px 15px;
          background: var(--ri-linen);
          border-bottom: 1px solid var(--ri-border);
          color: var(--ri-muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .ri-distribution-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }

        .ri-distribution-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 17px 15px;
          border-right: 1px solid var(--ri-border);
        }

        .ri-distribution-item:last-child {
          border-right: 0;
        }

        .ri-distribution-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--ri-muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ri-distribution-item strong {
          font-family: "Newsreader", Georgia, serif;
          font-size: 22px;
          font-weight: 500;
        }

        .ri-distribution-dot {
          width: 7px;
          height: 7px;
          display: inline-block;
        }

        .nd-risk-low {
          background: var(--ri-green);
        }

        .nd-risk-moderate {
          background: #8c887e;
        }

        .nd-risk-high {
          background: var(--ri-orange);
        }

        .nd-risk-critical {
          background: var(--ri-ink);
        }

        /* ------------------------------------------------------------------ */
        /* Coverage                                                           */
        /* ------------------------------------------------------------------ */

        .ri-coverage {
          margin-top: 16px;
          padding: 17px;
          background: var(--ri-white);
          border: 1px solid var(--ri-border);
        }

        .ri-coverage > div:first-child {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          color: var(--ri-muted);
          font-size: 10px;
        }

        .ri-coverage strong {
          color: var(--ri-ink);
          font-weight: 600;
        }

        .ri-coverage-track {
          height: 4px;
          margin-top: 10px;
          background: var(--ri-linen);
        }

        .ri-coverage-track span {
          display: block;
          height: 100%;
          background: var(--ri-ink);
        }

        .ri-coverage p {
          margin: 10px 0 0;
          color: var(--ri-soft);
          font-size: 9px;
          line-height: 1.5;
        }

        /* ------------------------------------------------------------------ */
        /* Table                                                              */
        /* ------------------------------------------------------------------ */

        .ri-table-shell {
          background: var(--ri-white);
          border: 1px solid var(--ri-border);
        }

        .ri-table-topline {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 11px 15px;
          border-bottom: 1px solid var(--ri-border);
          color: var(--ri-soft);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .ri-table {
          min-width: 950px;
        }

        .ri-table th {
          padding: 12px 14px;
          background: var(--ri-linen);
          border-bottom: 1px solid var(--ri-border);
          color: var(--ri-muted);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .ri-table td {
          padding: 14px;
          border-bottom: 1px solid var(--ri-border);
          color: var(--ri-muted);
          font-size: 10px;
          white-space: nowrap;
        }

        .ri-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .ri-project-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          max-width: 340px;
          color: var(--ri-ink);
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
          white-space: normal;
        }

        .ri-project-link:hover {
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .ri-project-link svg {
          flex: 0 0 auto;
          color: var(--ri-soft);
          transition: transform 150ms ease;
        }

        .ri-project-link:hover svg {
          transform: translateX(3px);
        }

        .ri-score {
          color: var(--ri-ink) !important;
          font-family: "Newsreader", Georgia, serif;
          font-size: 18px !important;
          font-weight: 500;
        }

        .nd-risk-level {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 3px 7px;
          border: 1px solid var(--ri-border-dark);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .nd-risk-level.nd-risk-low {
          border-color: var(--ri-green);
          color: var(--ri-green);
          background: transparent;
        }

        .nd-risk-level.nd-risk-moderate {
          border-color: #8c887e;
          color: #69665f;
          background: transparent;
        }

        .nd-risk-level.nd-risk-high,
        .nd-risk-level.nd-risk-critical {
          border-color: var(--ri-orange);
          color: var(--ri-orange);
          background: transparent;
        }

        /* ------------------------------------------------------------------ */
        /* Methodology                                                        */
        /* ------------------------------------------------------------------ */

        .ri-methodology {
          display: grid;
          grid-template-columns: 55px minmax(0, 1.5fr) minmax(300px, 1fr);
          gap: 25px;
          align-items: start;
          padding: 25px;
          background: var(--ri-linen);
          border: 1px solid var(--ri-border);
        }

        .ri-method-number {
          color: var(--ri-soft);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .ri-method-content h3 {
          margin: 0;
          font-family: "Newsreader", Georgia, serif;
          font-size: 27px;
          font-weight: 500;
        }

        .ri-method-content p {
          max-width: 680px;
          margin: 9px 0 0;
          color: var(--ri-muted);
          font-size: 11px;
          line-height: 1.7;
        }

        .ri-method-points {
          border-top: 1px solid var(--ri-border-dark);
        }

        .ri-method-points div {
          display: flex;
          gap: 14px;
          padding: 10px 0;
          border-bottom: 1px solid var(--ri-border);
        }

        .ri-method-points span {
          color: var(--ri-soft);
          font-size: 8px;
          font-weight: 700;
        }

        .ri-method-points p {
          margin: 0;
          color: var(--ri-ink);
          font-size: 10px;
        }

        /* ------------------------------------------------------------------ */
        /* Error / unavailable                                               */
        /* ------------------------------------------------------------------ */

        .ri-error-section {
          padding: 28px 0;
        }

        .ri-error {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 17px;
          background: var(--ri-white);
          border: 1px solid var(--ri-orange);
        }

        .ri-error-icon {
          color: var(--ri-orange);
        }

        .ri-error strong {
          display: block;
          font-size: 11px;
          font-weight: 600;
        }

        .ri-error p {
          margin: 5px 0 0;
          color: var(--ri-muted);
          font-size: 10px;
        }

        .ri-retry {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-left: auto;
          padding: 8px 11px;
          border: 1px solid var(--ri-border-dark);
          background: var(--ri-white);
          color: var(--ri-ink);
          cursor: pointer;
          font-family: inherit;
          font-size: 9px;
          font-weight: 600;
        }

        .ri-unavailable {
          display: flex;
          align-items: center;
          min-height: 100px;
          padding: 22px;
          background: var(--ri-white);
          border: 1px solid var(--ri-border);
        }

        .ri-unavailable strong {
          font-size: 11px;
          font-weight: 600;
        }

        .ri-unavailable p {
          margin: 6px 0 0;
          color: var(--ri-muted);
          font-size: 10px;
          line-height: 1.6;
        }

        /* ------------------------------------------------------------------ */
        /* Loading                                                            */
        /* ------------------------------------------------------------------ */

        .ri-loading {
          padding: 42px 0;
        }

        .ri-skeleton {
          background: linear-gradient(
            90deg,
            #efebe4 25%,
            #f8f6f2 50%,
            #efebe4 75%
          );
          background-size: 200% 100%;
          animation: ri-loading 1.4s infinite;
        }

        .ri-skeleton-small {
          width: 120px;
          height: 14px;
          margin-bottom: 45px;
        }

        .ri-skeleton-title {
          width: 55%;
          height: 70px;
        }

        .ri-skeleton-line {
          width: 38%;
          height: 13px;
          margin-top: 15px;
        }

        .ri-skeleton-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          margin-top: 42px;
          background: var(--ri-border);
        }

        .ri-skeleton-card {
          height: 145px;
          background-color: var(--ri-white);
        }

        @keyframes ri-loading {
          from {
            background-position: 200% 0;
          }

          to {
            background-position: -200% 0;
          }
        }

        /* ------------------------------------------------------------------ */
        /* Footer                                                             */
        /* ------------------------------------------------------------------ */

        .ri-footer {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding-top: 20px;
          color: var(--ri-soft);
          font-size: 9px;
        }

        .ri-footer strong {
          color: var(--ri-muted);
        }

        /* ------------------------------------------------------------------ */
        /* Responsive                                                         */
        /* ------------------------------------------------------------------ */

        @media (max-width: 1000px) {
          .ri-hero-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .ri-status {
            max-width: 420px;
          }

          .ri-ledger {
            grid-template-columns: repeat(2, 1fr);
          }

          .ri-distribution-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .ri-distribution-item:nth-child(2) {
            border-right: 0;
          }

          .ri-distribution-item:nth-child(-n + 2) {
            border-bottom: 1px solid var(--ri-border);
          }

          .ri-filters {
            grid-template-columns: repeat(2, 1fr);
          }

          .ri-methodology {
            grid-template-columns: 45px 1fr;
          }

          .ri-method-points {
            grid-column: 2;
          }
        }

        @media (max-width: 700px) {
          .ri-shell {
            width: calc(100% - 24px);
            padding-top: 20px;
          }

          .ri-hero-top {
            align-items: flex-start;
            flex-direction: column;
            margin-bottom: 40px;
          }

          .ri-record-label {
            display: none;
          }

          .ri-hero h1 {
            font-size: 52px;
          }

          .ri-section {
            padding: 32px 0;
          }

          .ri-section-copy h2 {
            font-size: 27px;
          }

          .ri-ledger {
            grid-template-columns: 1fr;
          }

          .ri-metric {
            min-height: 120px;
          }

          .ri-distribution-grid {
            grid-template-columns: 1fr;
          }

          .ri-distribution-item,
          .ri-distribution-item:nth-child(2) {
            border-right: 0;
            border-bottom: 1px solid var(--ri-border);
          }

          .ri-distribution-item:last-child {
            border-bottom: 0;
          }

          .ri-filters {
            grid-template-columns: 1fr;
          }

          .ri-filter-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .ri-methodology {
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .ri-method-points {
            grid-column: auto;
          }

          .ri-error {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .ri-retry {
            margin-left: 31px;
          }

          .ri-footer {
            flex-direction: column;
          }
        }

        @media (max-width: 480px) {
          .ri-hero h1 {
            font-size: 45px;
          }

          .ri-section-header {
            grid-template-columns: 30px minmax(0, 1fr);
            gap: 10px;
          }

          .ri-section-number {
            font-size: 9px;
          }

          .ri-status {
            min-height: auto;
          }

          .ri-methodology {
            padding: 18px;
          }

          .ri-table-topline {
            align-items: flex-start;
            flex-direction: column;
            gap: 5px;
          }
        }
      `}</style>
    </>
  );
}
