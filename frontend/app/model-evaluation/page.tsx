"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import {
  getMLEvaluation,
  type ApiMLEvaluation,
  type ApiMLEvaluationResult,
} from "@/lib/api";

import { fmtInt, fmtPct, Unavailable } from "@/components/charts";

const metrics = [
  ["precision", "Precision"],
  ["recall", "Recall"],
  ["f1", "F1"],
  ["roc_auc", "ROC-AUC"],
  ["pr_auc", "PR-AUC"],
] as const;

type MetricKey = (typeof metrics)[number][0];

function metricValue(
  result: ApiMLEvaluationResult | undefined,
  key: MetricKey,
) {
  if (!result || result[key] == null) return null;
  return Number(result[key]) * 100;
}

function formatMetric(
  result: ApiMLEvaluationResult | undefined,
  key: MetricKey,
) {
  const value = metricValue(result, key);
  return value == null ? "—" : fmtPct(value);
}

function getResult(
  results: ApiMLEvaluationResult[],
  approach: "ml" | "conventional",
) {
  return results.find((item) => item.approach === approach);
}

function getF1Winner(
  conventional: ApiMLEvaluationResult | undefined,
  ml: ApiMLEvaluationResult | undefined,
) {
  if (!conventional || !ml) return null;
  if (conventional.f1 == null || ml.f1 == null) return null;

  if (ml.f1 > conventional.f1) return "ml";
  if (conventional.f1 > ml.f1) return "conventional";

  return "tie";
}

function f1Difference(
  conventional: ApiMLEvaluationResult | undefined,
  ml: ApiMLEvaluationResult | undefined,
) {
  if (!conventional || !ml) return null;
  if (conventional.f1 == null || ml.f1 == null) return null;

  return (Number(ml.f1) - Number(conventional.f1)) * 100;
}

function buildChartData(
  conventional: ApiMLEvaluationResult | undefined,
  ml: ApiMLEvaluationResult | undefined,
) {
  return metrics.map(([key, label]) => ({
    metric: label,
    Conventional:
      conventional?.[key] == null
        ? null
        : Number(conventional[key]) * 100,
    ML: ml?.[key] == null ? null : Number(ml[key]) * 100,
  }));
}

function ModelBadge({
  approach,
}: {
  approach: "ml" | "conventional" | "tie" | null;
}) {
  if (!approach) return null;

  if (approach === "tie") {
    return (
      <span className="model-badge model-badge-tie">
        Similar performance
      </span>
    );
  }

  return (
    <span
      className={
        approach === "ml"
          ? "model-badge model-badge-ml"
          : "model-badge model-badge-conventional"
      }
    >
      {approach === "ml"
        ? "ML leads"
        : "Conventional leads"}
    </span>
  );
}
function KPI({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="eval-kpi">
      <div className="eval-kpi-label">{label}</div>
      <div className="eval-kpi-value">{value}</div>
      <div className="eval-kpi-detail">{detail}</div>
    </div>
  );
}

function EvaluationChart({
  conventional,
  ml,
}: {
  conventional?: ApiMLEvaluationResult;
  ml?: ApiMLEvaluationResult;
}) {
  const chartData = useMemo(
    () => buildChartData(conventional, ml),
    [conventional, ml],
  );

  const hasData = chartData.some(
    (item) => item.Conventional != null || item.ML != null,
  );

  if (!hasData) {
    return (
      <div className="chart-empty">
        <Unavailable reason="No evaluation metrics are available for visualization." />
      </div>
    );
  }

  return (
    <div className="evaluation-chart">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 20,
            left: 0,
            bottom: 10,
          }}
          barGap={8}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="rgba(0,0,0,0.08)"
          />

          <XAxis
            dataKey="metric"
            tick={{
              fontSize: 12,
              fill: "#555",
            }}
            axisLine={{
              stroke: "#d9d9d9",
            }}
            tickLine={false}
          />

          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{
              fontSize: 12,
              fill: "#666",
            }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            formatter={(value) =>
              value == null ? "—" : `${Number(value).toFixed(1)}%`
            }
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #ddd",
              boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
              background: "#fff",
            }}
          />

          <Legend
            verticalAlign="top"
            align="right"
            height={45}
          />

          <Bar
            dataKey="Conventional"
            name="Conventional"
            fill="#9a9a9a"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />

          <Bar
            dataKey="ML"
            name="Machine learning"
            fill="#111111"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricTable({
  conventional,
  ml,
}: {
  conventional?: ApiMLEvaluationResult;
  ml?: ApiMLEvaluationResult;
}) {
  return (
    <div className="metric-table">
      <div className="metric-row metric-row-head">
        <span>Metric</span>
        <span>Conventional</span>
        <span>ML</span>
        <span>Difference</span>
      </div>

      {metrics.map(([key, label]) => {
        const conventionalValue = metricValue(conventional, key);
        const mlValue = metricValue(ml, key);

        const difference =
          conventionalValue != null && mlValue != null
            ? mlValue - conventionalValue
            : null;

        return (
          <div className="metric-row" key={key}>
            <span className="metric-name">{label}</span>

            <span>
              {conventionalValue == null
                ? "—"
                : fmtPct(conventionalValue)}
            </span>

            <span className="metric-ml">
              {mlValue == null ? "—" : fmtPct(mlValue)}
            </span>

            <span
              className={
                difference == null
                  ? ""
                  : difference > 0
                    ? "metric-positive"
                    : difference < 0
                      ? "metric-negative"
                      : ""
              }
            >
              {difference == null
                ? "—"
                : `${difference > 0 ? "+" : ""}${difference.toFixed(1)} pts`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TaskSection({
  title,
  eyebrow,
  description,
  results,
  conclusion,
}: {
  title: string;
  eyebrow: string;
  description: string;
  results: ApiMLEvaluationResult[];
  conclusion?: string;
}) {
  const conventional = getResult(results, "conventional");
  const ml = getResult(results, "ml");

  const winner = getF1Winner(conventional, ml);
  const difference = f1Difference(conventional, ml);

  const sampleCount =
    conventional?.sample_count ?? ml?.sample_count ?? null;

  const positiveRate =
    conventional?.positive_rate ?? ml?.positive_rate ?? null;

  return (
    <section className="evaluation-section">
      <div className="evaluation-section-header">
        <div>
          <div className="section-eyebrow">{eyebrow}</div>

          <h2>{title}</h2>

          <p>{description}</p>
        </div>

        <ModelBadge approach={winner} />
      </div>

      {/* Task summary */}
      <div className="task-kpis">
        <KPI
          label="ML F1"
          value={formatMetric(ml, "f1")}
          detail="held-out evaluation"
        />

        <KPI
          label="Conventional F1"
          value={formatMetric(conventional, "f1")}
          detail="baseline comparison"
        />

        <KPI
          label="F1 difference"
          value={
            difference == null
              ? "—"
              : `${difference > 0 ? "+" : ""}${difference.toFixed(1)} pts`
          }
          detail="ML minus conventional"
        />

        <KPI
          label="Test samples"
          value={sampleCount == null ? "—" : fmtInt(sampleCount)}
          detail="held-out observations"
        />

        <KPI
          label="Positive rate"
          value={
            positiveRate == null
              ? "—"
              : fmtPct(Number(positiveRate) * 100)
          }
          detail="evaluation set"
        />
      </div>

      {/* Main graph */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <span className="section-eyebrow">
              Performance comparison
            </span>

            <h3>ML vs conventional approach</h3>

            <p>
              Higher values indicate stronger performance for the
              corresponding evaluation metric.
            </p>
          </div>
        </div>

        <EvaluationChart
          conventional={conventional}
          ml={ml}
        />
      </div>

      {/* Metrics */}
      <div className="metric-detail-grid">
        <div className="detail-card">
          <div className="detail-card-top">
            <span className="section-eyebrow">
              Conventional
            </span>

            <span className="small-tag">Baseline</span>
          </div>

          <h3>Existing approach</h3>

          <MetricTable
            conventional={conventional}
            ml={undefined}
          />
        </div>

        <div className="detail-card detail-card-primary">
          <div className="detail-card-top">
            <span className="section-eyebrow">
              Machine learning
            </span>

            <span className="small-tag small-tag-dark">
              Predictive
            </span>
          </div>

          <h3>ML prediction model</h3>

          <MetricTable
            conventional={undefined}
            ml={ml}
          />
        </div>
      </div>

      {/* Actual comparison table */}
      <div className="comparison-table-card">
        <div className="comparison-table-header">
          <div>
            <span className="section-eyebrow">
              Detailed comparison
            </span>

            <h3>Evaluation evidence</h3>
          </div>

          {winner === "ml" && (
            <span className="comparison-result">
              ML has higher F1
            </span>
          )}
        </div>

        <MetricTable
          conventional={conventional}
          ml={ml}
        />
      </div>

      {/* Interpretation */}
      <div className="interpretation-grid">
        <div className="interpretation-card">
          <span className="section-eyebrow">
            Officer interpretation
          </span>

          <h3>What does this result mean?</h3>

          <p>
            {conclusion ||
              "The available evaluation evidence is insufficient to provide a reliable interpretation."}
          </p>
        </div>

        <div className="interpretation-card">
          <span className="section-eyebrow">
            Recommended use
          </span>

          <h3>How should the signal be used?</h3>

          <p>
            Use the prediction as a{" "}
            <strong>screening and prioritisation signal</strong>{" "}
            to identify projects that may require closer monitoring.
          </p>
        </div>
      </div>

      {/* Important warning */}
      <div className="evaluation-notice">
        <div className="notice-icon">!</div>

        <div>
          <strong>Prediction is not confirmation</strong>

          <p>
            A higher predicted likelihood does not mean that a cost
            or schedule revision will definitely occur. The signal
            should be reviewed with project evidence before taking
            monitoring action.
          </p>
        </div>
      </div>
    </section>
  );
}

function ExecutiveOverview({
  data,
}: {
  data: ApiMLEvaluation;
}) {
  const costConventional = getResult(
    data.cost_comparison,
    "conventional",
  );

  const costMl = getResult(data.cost_comparison, "ml");

  const scheduleConventional = getResult(
    data.schedule_comparison,
    "conventional",
  );

  const scheduleMl = getResult(
    data.schedule_comparison,
    "ml",
  );

  const costWinner = getF1Winner(
    costConventional,
    costMl,
  );

  const scheduleWinner = getF1Winner(
    scheduleConventional,
    scheduleMl,
  );

  const costDelta = f1Difference(
    costConventional,
    costMl,
  );

  const scheduleDelta = f1Difference(
    scheduleConventional,
    scheduleMl,
  );

  return (
    <section className="overview-section">
      <div className="overview-heading">
        <div>
          <span className="section-eyebrow">
            Executive view
          </span>

          <h2>Predictive intelligence assessment</h2>

          <p>
            A concise view of how the predictive models perform
            against the conventional approaches.
          </p>
        </div>

        <div className="evaluation-status">
          <span className="status-dot" />
          Evaluation available
        </div>
      </div>

      <div className="overview-grid">
        {/* Cost */}
        <div className="overview-card">
          <div className="overview-card-top">
            <span className="section-eyebrow">
              Cost revision
            </span>

            {costWinner === "ml" && (
              <span className="mini-badge">
                ML advantage
              </span>
            )}
          </div>

          <div className="overview-main">
            <div>
              <span className="overview-label">
                ML F1
              </span>

              <strong>
                {formatMetric(costMl, "f1")}
              </strong>
            </div>

            <div className="overview-delta">
              {costDelta == null
                ? "—"
                : `${costDelta > 0 ? "+" : ""}${costDelta.toFixed(1)} pts`}
            </div>
          </div>

          <div className="overview-footer">
            <span>
              Baseline:{" "}
              {formatMetric(
                costConventional,
                "f1",
              )}
            </span>

            <span>
              {costWinner === "ml"
                ? "Higher ML F1"
                : costWinner === "tie"
                  ? "Similar F1"
                  : "Review evidence"}
            </span>
          </div>
        </div>

        {/* Schedule */}
        <div className="overview-card">
          <div className="overview-card-top">
            <span className="section-eyebrow">
              Schedule revision
            </span>

            {scheduleWinner === "ml" && (
              <span className="mini-badge">
                ML advantage
              </span>
            )}
          </div>

          <div className="overview-main">
            <div>
              <span className="overview-label">
                ML F1
              </span>

              <strong>
                {formatMetric(scheduleMl, "f1")}
              </strong>
            </div>

            <div className="overview-delta">
              {scheduleDelta == null
                ? "—"
                : `${scheduleDelta > 0 ? "+" : ""}${scheduleDelta.toFixed(1)} pts`}
            </div>
          </div>

          <div className="overview-footer">
            <span>
              Baseline:{" "}
              {formatMetric(
                scheduleConventional,
                "f1",
              )}
            </span>

            <span>
              {scheduleWinner === "ml"
                ? "Higher ML F1"
                : scheduleWinner === "tie"
                  ? "Similar F1"
                  : "Review evidence"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function DecisionPanel() {
  return (
    <section className="decision-section">
      <div className="decision-panel">
        <div className="decision-icon">→</div>

        <div className="decision-content">
          <span className="section-eyebrow">
            Monitoring workflow
          </span>

          <h2>
            Use prediction to prioritise review — not to
            replace judgement.
          </h2>

          <p>
            The predictive models are intended to help monitoring
            authorities identify projects that deserve closer
            examination. The final decision remains with the
            responsible officer and should consider the underlying
            project evidence.
          </p>

          <div className="decision-flow">
            <span>Prediction signal</span>
            <b>→</b>
            <span>Project review</span>
            <b>→</b>
            <span>Evidence verification</span>
            <b>→</b>
            <span>Officer action</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ModelEvaluationPage() {
  const [data, setData] = useState<ApiMLEvaluation | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getMLEvaluation({
      signal: controller.signal,
    })
      .then(setData)
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Model evaluation could not be loaded.",
          );
        }
      });

    return () => controller.abort();
  }, []);

  const evaluationDate = useMemo(() => {
    if (!data?.evaluation_timestamp) {
      return "Awaiting result";
    }

    const date = new Date(data.evaluation_timestamp);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [data]);

  return (
    <main className="model-evaluation-page">
      {/* =====================================================
          HERO
      ===================================================== */}
      <section className="evaluation-hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="section-eyebrow">
              Predictive intelligence / model evaluation
            </div>

            <h1>
              How reliable are our
              <br />
              project predictions?
            </h1>

            <p>
              Evidence-based evaluation of cost and schedule
              revision prediction models against conventional
              approaches.
            </p>
          </div>

          <div className="hero-meta">
            <div>
              <span>Evaluation version</span>
              <strong>
                {data?.evaluation_version || "—"}
              </strong>
            </div>

            <div>
              <span>Evaluated</span>
              <strong>{evaluationDate}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ERROR
      ===================================================== */}
      {error ? (
        <section className="state-section">
          <div className="state-error">{error}</div>
        </section>
      ) : !data ? (
        <section className="state-section">
          <div className="state-loading">
            <div className="loading-line" />
            Loading evaluation evidence...
          </div>
        </section>
      ) : (
        <>
          {/* =================================================
              EXECUTIVE OVERVIEW
          ================================================= */}
          <ExecutiveOverview data={data} />

          {/* =================================================
              COST REVISION
          ================================================= */}
          <TaskSection
            eyebrow="01 / Cost intelligence"
            title="Cost revision prediction"
            description="How effectively can the model identify projects with a higher likelihood of future reported cost revision?"
            results={data.cost_comparison}
            conclusion={data.conclusion.cost_revision}
          />

          {/* =================================================
              SCHEDULE REVISION
          ================================================= */}
          <TaskSection
            eyebrow="02 / Schedule intelligence"
            title="Schedule revision prediction"
            description="How effectively can the model identify projects with a higher likelihood of future reported schedule revision?"
            results={data.schedule_comparison}
            conclusion={
              data.conclusion.schedule_revision
            }
          />

          {/* =================================================
              DECISION SUPPORT
          ================================================= */}
          <DecisionPanel />

          {/* =================================================
              LIMITATIONS
          ================================================= */}
          <section className="limitations-section">
            <div className="limitations-heading">
              <div>
                <span className="section-eyebrow">
                  03 / Methodology
                </span>

                <h2>Evaluation limitations</h2>
              </div>

              <span className="methodology-label">
                Transparency
              </span>
            </div>

            <div className="limitations-list">
              {data.limitations.length > 0 ? (
                data.limitations.map(
                  (limitation, index) => (
                    <div
                      className="limitation-item"
                      key={limitation}
                    >
                      <span>
                        {String(index + 1).padStart(
                          2,
                          "0",
                        )}
                      </span>

                      <p>{limitation}</p>
                    </div>
                  ),
                )
              ) : (
                <div className="limitation-item">
                  <span>01</span>
                  <p>
                    No additional limitations were
                    provided by the evaluation service.
                  </p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* =====================================================
          PAGE STYLES
      ===================================================== */}
      <style jsx global>{`
        .model-evaluation-page {
          min-height: 100vh;
          background: #f7f7f5;
          color: #111;
          font-family:
            "Times New Roman",
            Times,
            serif;
        }

        .evaluation-hero {
          background: #fff;
          border-bottom: 1px solid #deded9;
        }

        .hero-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 78px 48px 72px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 80px;
          align-items: end;
        }

        .section-eyebrow {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 10px;
          line-height: 1;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: #737373;
          font-weight: 700;
        }

        .hero-copy h1 {
          margin: 18px 0 22px;
          max-width: 850px;
          font-size: clamp(48px, 6vw, 78px);
          line-height: 0.96;
          letter-spacing: -0.045em;
          font-weight: 400;
        }

        .hero-copy > p {
          max-width: 660px;
          margin: 0;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #5d5d5d;
          font-size: 15px;
          line-height: 1.7;
        }

        .hero-meta {
          border-left: 1px solid #d7d7d2;
          padding-left: 28px;
          display: flex;
          flex-direction: column;
          gap: 25px;
        }

        .hero-meta div {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .hero-meta span {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #888;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .hero-meta strong {
          font-size: 18px;
          font-weight: 500;
        }

        .overview-section,
        .evaluation-section,
        .decision-section,
        .limitations-section {
          max-width: 1280px;
          margin: 0 auto;
          padding-left: 48px;
          padding-right: 48px;
        }

        .overview-section {
          padding-top: 52px;
          padding-bottom: 68px;
        }

        .overview-heading {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 30px;
          margin-bottom: 28px;
        }

        .overview-heading h2,
        .limitations-heading h2 {
          margin: 11px 0 8px;
          font-size: 31px;
          font-weight: 400;
          letter-spacing: -0.02em;
        }

        .overview-heading p {
          margin: 0;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #666;
          font-size: 13px;
        }

        .evaluation-status {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #d8d8d3;
          background: #fff;
          padding: 9px 13px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 11px;
          white-space: nowrap;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #111;
          display: inline-block;
        }

        .overview-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .overview-card {
          background: #fff;
          border: 1px solid #dddcd7;
          padding: 25px 27px 21px;
        }

        .overview-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mini-badge,
        .model-badge,
        .small-tag,
        .comparison-result {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
        }

        .mini-badge {
          border: 1px solid #111;
          padding: 6px 8px;
        }

        .overview-main {
          margin: 27px 0 23px;
          display: flex;
          justify-content: space-between;
          align-items: end;
        }

        .overview-main div:first-child {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .overview-label {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #777;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .overview-main strong {
          font-size: 54px;
          line-height: 0.9;
          font-weight: 400;
          letter-spacing: -0.04em;
        }

        .overview-delta {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 15px;
          font-weight: 700;
        }

        .overview-footer {
          border-top: 1px solid #e4e4df;
          padding-top: 14px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 11px;
          color: #666;
        }

        .evaluation-section {
          padding-top: 74px;
          padding-bottom: 80px;
          border-top: 1px solid #deded9;
        }

        .evaluation-section-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 30px;
          margin-bottom: 30px;
        }

        .evaluation-section-header h2 {
          margin: 12px 0 8px;
          font-size: 42px;
          font-weight: 400;
          letter-spacing: -0.035em;
        }

        .evaluation-section-header p {
          margin: 0;
          max-width: 690px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 13px;
          color: #666;
          line-height: 1.6;
        }

        .model-badge {
          padding: 8px 11px;
          border: 1px solid #111;
          white-space: nowrap;
        }

        .model-badge-ml {
          background: #111;
          color: #fff;
        }

        .model-badge-conventional {
          background: #fff;
          color: #111;
        }

        .task-kpis {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          border-top: 1px solid #d9d9d4;
          border-bottom: 1px solid #d9d9d4;
          margin-bottom: 28px;
        }

        .eval-kpi {
          padding: 19px 18px;
          border-right: 1px solid #deded9;
        }

        .eval-kpi:last-child {
          border-right: 0;
        }

        .eval-kpi-label {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #777;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-size: 9px;
          font-weight: 700;
        }

        .eval-kpi-value {
          margin-top: 9px;
          font-size: 29px;
          font-weight: 400;
        }

        .eval-kpi-detail {
          margin-top: 4px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 9px;
          color: #888;
        }

        .chart-card {
          background: #fff;
          border: 1px solid #dddcd7;
          padding: 27px 28px 16px;
          margin-bottom: 17px;
        }

        .chart-header {
          margin-bottom: 5px;
        }

        .chart-header h3 {
          margin: 8px 0 5px;
          font-size: 23px;
          font-weight: 400;
        }

        .chart-header p {
          margin: 0;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #777;
          font-size: 11px;
        }

        .evaluation-chart {
          width: 100%;
          margin-top: 18px;
        }

        .chart-empty {
          height: 360px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .metric-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
          margin-bottom: 17px;
        }

        .detail-card,
        .comparison-table-card {
          background: #fff;
          border: 1px solid #dddcd7;
          padding: 25px 27px;
        }

        .detail-card-primary {
          border-color: #111;
        }

        .detail-card-top,
        .comparison-table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .small-tag {
          border: 1px solid #d5d5d0;
          padding: 5px 7px;
        }

        .small-tag-dark {
          background: #111;
          border-color: #111;
          color: #fff;
        }

        .detail-card h3,
        .comparison-table-header h3 {
          margin: 10px 0 20px;
          font-size: 22px;
          font-weight: 400;
        }

        .metric-table {
          width: 100%;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
        }

        .metric-row {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1fr;
          gap: 12px;
          align-items: center;
          min-height: 43px;
          border-top: 1px solid #e8e8e3;
          font-size: 11px;
          color: #555;
        }

        .metric-row-head {
          border-top: 0;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 8px;
          font-weight: 700;
        }

        .metric-name {
          color: #222;
        }

        .metric-ml {
          color: #111;
          font-weight: 700;
        }

        .metric-positive {
          font-weight: 700;
        }

        .metric-negative {
          color: #777;
        }

        .comparison-table-card {
          margin-bottom: 17px;
        }

        .comparison-table-header {
          margin-bottom: 13px;
        }

        .comparison-result {
          background: #111;
          color: #fff;
          padding: 7px 9px;
        }

        .interpretation-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
          margin-top: 17px;
        }

        .interpretation-card {
          background: #ecece8;
          padding: 25px 27px;
          min-height: 190px;
        }

        .interpretation-card h3 {
          margin: 12px 0 13px;
          font-size: 21px;
          font-weight: 400;
        }

        .interpretation-card p {
          margin: 0;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #555;
          font-size: 12px;
          line-height: 1.75;
        }

        .evaluation-notice {
          margin-top: 17px;
          display: grid;
          grid-template-columns: 35px 1fr;
          gap: 17px;
          padding: 21px 24px;
          border: 1px solid #cfcfc9;
          background: #fff;
        }

        .notice-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #111;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-weight: 700;
          font-size: 12px;
        }

        .evaluation-notice strong {
          font-size: 15px;
          font-weight: 600;
        }

        .evaluation-notice p {
          margin: 7px 0 0;
          max-width: 850px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #666;
          font-size: 11px;
          line-height: 1.7;
        }

        .decision-section {
          padding-top: 20px;
          padding-bottom: 75px;
        }

        .decision-panel {
          background: #111;
          color: #fff;
          padding: 36px 40px;
          display: grid;
          grid-template-columns: 45px 1fr;
          gap: 25px;
        }

        .decision-icon {
          width: 38px;
          height: 38px;
          border: 1px solid #555;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 18px;
        }

        .decision-content h2 {
          margin: 12px 0 12px;
          max-width: 780px;
          font-size: 31px;
          line-height: 1.1;
          font-weight: 400;
        }

        .decision-content p {
          max-width: 780px;
          margin: 0;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #c7c7c7;
          font-size: 12px;
          line-height: 1.7;
        }

        .decision-flow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 27px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .decision-flow span {
          border: 1px solid #444;
          padding: 8px 10px;
        }

        .decision-flow b {
          color: #777;
        }

        .limitations-section {
          padding-top: 0;
          padding-bottom: 100px;
        }

        .limitations-heading {
          display: flex;
          justify-content: space-between;
          align-items: end;
          border-top: 1px solid #d7d7d2;
          padding-top: 34px;
          margin-bottom: 25px;
        }

        .methodology-label {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #888;
        }

        .limitations-list {
          background: #fff;
          border: 1px solid #dddcd7;
        }

        .limitation-item {
          display: grid;
          grid-template-columns: 65px 1fr;
          gap: 20px;
          padding: 20px 25px;
          border-bottom: 1px solid #e5e5e0;
        }

        .limitation-item:last-child {
          border-bottom: 0;
        }

        .limitation-item > span {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 10px;
          color: #999;
        }

        .limitation-item p {
          margin: 0;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 12px;
          color: #555;
          line-height: 1.6;
        }

        .state-section {
          max-width: 1280px;
          margin: 0 auto;
          padding: 60px 48px;
        }

        .state-error,
        .state-loading {
          background: #fff;
          border: 1px solid #dddcd7;
          padding: 25px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 12px;
        }

        .state-error {
          border-left: 3px solid #111;
        }

        .loading-line {
          width: 100%;
          height: 2px;
          background: #111;
          margin-bottom: 15px;
          animation: evaluation-loading 1.3s ease-in-out infinite;
        }

        @keyframes evaluation-loading {
          0% {
            opacity: 0.25;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.25;
          }
        }

        @media (max-width: 900px) {
          .hero-inner {
            grid-template-columns: 1fr;
            gap: 40px;
            padding: 55px 28px;
          }

          .hero-meta {
            border-left: 0;
            border-top: 1px solid #ddd;
            padding-left: 0;
            padding-top: 22px;
            flex-direction: row;
            justify-content: space-between;
          }

          .overview-section,
          .evaluation-section,
          .decision-section,
          .limitations-section {
            padding-left: 28px;
            padding-right: 28px;
          }

          .task-kpis {
            grid-template-columns: repeat(3, 1fr);
          }

          .eval-kpi:nth-child(3) {
            border-right: 0;
          }

          .eval-kpi:nth-child(n + 4) {
            border-top: 1px solid #deded9;
          }

          .metric-detail-grid,
          .interpretation-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .hero-copy h1 {
            font-size: 46px;
          }

          .overview-grid {
            grid-template-columns: 1fr;
          }

          .overview-heading,
          .evaluation-section-header,
          .limitations-heading {
            align-items: start;
            flex-direction: column;
          }

          .task-kpis {
            grid-template-columns: repeat(2, 1fr);
          }

          .eval-kpi:nth-child(even) {
            border-right: 0;
          }

          .eval-kpi:nth-child(n + 3) {
            border-top: 1px solid #deded9;
          }

          .metric-row {
            grid-template-columns: 1.2fr 0.9fr 0.9fr;
          }

          .metric-row > span:last-child {
            display: none;
          }

          .decision-panel {
            grid-template-columns: 1fr;
            padding: 28px;
          }

          .decision-flow {
            align-items: flex-start;
            flex-direction: column;
          }

          .decision-flow b {
            transform: rotate(90deg);
          }

          .state-section {
            padding-left: 28px;
            padding-right: 28px;
          }
        }
      `}</style>
    </main>
  );
}