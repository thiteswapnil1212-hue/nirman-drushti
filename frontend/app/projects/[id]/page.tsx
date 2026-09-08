"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getProject,
  getProjectHistory,
  type ApiProject,
  type ApiProjectHistory,
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

const dateLabel = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "Not available";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [project, setProject] = useState<ApiProject | null>(null);
  const [history, setHistory] = useState<ApiProjectHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ id: projectId }) => {
      setLoading(true);
      setError(null);
      Promise.all([getProject(projectId), getProjectHistory(projectId)])
        .then(([projectResponse, historyResponse]) => {
          setProject(projectResponse);
          setHistory(historyResponse);
        })
        .catch((reason) => {
          setError(reason instanceof Error ? reason.message : "Project record unavailable.");
        })
        .finally(() => setLoading(false));
    });
  }, [params]);

  const progress = useMemo(() => history?.progress ?? [], [history]);
  const costs = useMemo(() => history?.costs ?? [], [history]);

  const progressValues = useMemo(
    () =>
      progress
        .map((item) => numeric(item.physical_progress))
        .filter((item): item is number => item !== null && Number.isFinite(item)),
    [progress]
  );

  if (error) {
    return (
      <div className="nd-page">
        <section className="nd-section">
          <div className="nd-container">
            <div className="nd-error">{error}</div>
          </div>
        </section>
      </div>
    );
  }

  if (loading || !project || !history) {
    return (
      <div className="nd-page">
        <section className="nd-section">
          <div className="nd-container">
            <div className="nd-empty">Loading project record and recorded history...</div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="nd-page">
      {/* ------------------------------------------------------------------
          Hero Section
      ------------------------------------------------------------------ */}
      <section className="nd-section nd-hero">
        <div className="nd-container">
          <Link href="/projects" className="nd-button nd-button-secondary nd-button-small" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <ArrowLeft size={14} /> Back to Register
          </Link>

          <p className="nd-eyebrow" style={{ marginTop: 24 }}>
            Project Register / Observed Record
          </p>

          <h1 className="nd-title nd-title-small">
            {project.name || "Project name not available"}
          </h1>

          <p className="nd-lead">
            {project.implementing_agency || "Agency not available"} &bull; {project.state || "State not available"}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          1. PROJECT OVERVIEW
      ------------------------------------------------------------------ */}
      <section className="nd-section nd-section-tight">
        <div className="nd-container">
          <p className="nd-eyebrow">Identity & Metadata</p>
          <h2 className="nd-heading" style={{ marginBottom: 20 }}>Project Overview</h2>

          <div className="nd-meta-grid">
            <div className="nd-meta-item">
              <p className="nd-label">Project Code</p>
              <strong>{project.project_code || "Not available"}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Legacy OCMS Code</p>
              <strong>{project.legacy_ocms_code || "Not available"}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">PMGID</p>
              <strong>{project.pmgid || "Not available"}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Ministry</p>
              <strong>{project.ministry || "Not available"}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Department</p>
              <strong>{project.department || "Not available"}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Implementing Agency</p>
              <strong>{project.implementing_agency || "Not available"}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Sector</p>
              <strong>{project.sector || "Not available"}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">State</p>
              <strong>{project.state || "Not available"}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Location</p>
              <strong>{project.location || "Not available"}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Monitoring Status</p>
              <strong>{project.status || "Not available"}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          2. FINANCIAL INFORMATION
      ------------------------------------------------------------------ */}
      <section className="nd-section">
        <div className="nd-container">
          <p className="nd-eyebrow">Financial Record & Analysis</p>
          <h2 className="nd-heading">Financial Information</h2>

          <div className="nd-ledger" style={{ marginTop: 28 }}>
            <div className="nd-ledger-item">
              <p className="nd-label">Original Approved Cost</p>
              <strong>{money(project.original_cost)}</strong>
              <p>Source project record</p>
            </div>

            <div className="nd-ledger-item">
              <p className="nd-label">Latest Current Cost</p>
              <strong>{money(project.current_cost)}</strong>
              <p>Source project record</p>
            </div>

            <div className="nd-ledger-item">
              <p className="nd-label">Cumulative Expenditure</p>
              <strong>{money(project.expenditure)}</strong>
              <p>Observed expenditure</p>
            </div>

          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          3. SCHEDULE & PROGRESS
      ------------------------------------------------------------------ */}
      <section className="nd-section">
        <div className="nd-container">
          <p className="nd-eyebrow">Schedule & Physical Progress</p>
          <h2 className="nd-heading">Timelines & Milestones</h2>

          <div className="nd-meta-grid" style={{ marginTop: 28 }}>
            <div className="nd-meta-item">
              <p className="nd-label">Planned Start Date</p>
              <strong>{dateLabel(project.planned_start_date)}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Planned Completion Date</p>
              <strong>{dateLabel(project.planned_completion_date)}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Expected Completion Date</p>
              <strong>{dateLabel(project.expected_completion_date)}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Physical Progress</p>
              <strong>{percent(project.physical_progress)}</strong>
            </div>

            <div className="nd-meta-item">
              <p className="nd-label">Expected Progress</p>
              <strong>{percent(project.expected_progress)}</strong>
            </div>

          </div>
        </div>
      </section>

      <section className="nd-section">
        <div className="nd-container">
          <div className="nd-section-heading">
            <div>
              <p className="nd-eyebrow">Historical Performance</p>
              <h2 className="nd-heading">Progress & Cost Observations</h2>
            </div>
            <p className="nd-section-intro">
              Historical records loaded directly from PAIMANA observation tables via PostgreSQL API.
            </p>
          </div>

          {progress.length === 0 && costs.length === 0 ? (
            <div className="nd-unavailable">
              <div>
                <strong>Awaiting historical observations</strong>
                <p>No monthly historical observations are currently recorded for this project.</p>
              </div>
            </div>
          ) : (
            <div className="nd-history-layout">
              <div>
                <h3 className="nd-heading-sm">Physical Progress Trajectory</h3>
                {progressValues.length > 0 ? (
                  <>
                    <div className="nd-bar-chart" style={{ marginTop: 16 }}>
                      {progressValues.map((item, index) => (
                        <span
                          className="nd-bar"
                          key={`${item}-${index}`}
                          style={{ height: `${Math.max(4, Math.min(100, item))}%` }}
                          title={`${item}%`}
                        />
                      ))}
                    </div>
                    <div className="nd-bar-labels">
                      {progress.slice(-progressValues.length).map((item) => (
                        <span key={item.id}>{dateLabel(item.reporting_period)}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="nd-subtext" style={{ marginTop: 12 }}>
                    No progress observations available.
                  </p>
                )}
              </div>

              <div>
                <h3 className="nd-heading-sm">Progress History</h3>
                <div className="nd-table-wrap" style={{ marginTop: 18 }}>
                  <table className="nd-history-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Progress</th>
                        <th>Expenditure</th>
                        <th>Source File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.map((item) => (
                        <tr key={item.id}>
                          <td>{dateLabel(item.reporting_period)}</td>
                          <td>{percent(item.physical_progress)}</td>
                          <td>{money(item.expenditure)}</td>
                          <td>{item.source_filename || "Not available"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3 className="nd-heading-sm" style={{ marginTop: 28 }}>Cost History</h3>
                <div className="nd-table-wrap" style={{ marginTop: 18 }}>
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
                      {costs.map((item) => (
                        <tr key={item.id}>
                          <td>{dateLabel(item.recorded_at)}</td>
                          <td>{money(item.original_cost)}</td>
                          <td>{money(item.current_cost)}</td>
                          <td>{money(item.expenditure)}</td>
                          <td>{item.source_filename || "Not available"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
