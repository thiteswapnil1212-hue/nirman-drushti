"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPortfolioAnalytics,
  getRiskSummary,
  listWarnings,
  type ApiPortfolioAnalytics,
  type ApiRiskSummaryResponse,
  type ApiWarningList,
} from "@/lib/api";
import {
  fmtCrore,
  fmtPct,
  fmtInt,
  toNum,
  Unavailable,
  SectionIndex,
  ChartCard,
  HBarChart,
  ComparisonBars,
  LineChart,
  DonutChart,
  Histogram,
  ScatterChart,
  BoxPlotChart,
  HeatmapTable,
} from "@/components/charts";

/* ─────────────────────── Metric tile ─────────────────────────── */
function MetricTile({
  label,
  value,
  sub,
  derived,
}: {
  label: string;
  value: string;
  sub?: string;
  derived?: boolean;
}) {
  return (
    <div className={`nd-intelligence-item${derived ? " nd-derived" : " nd-reported"}`}>
      <p className="nd-label">{label}</p>
      <strong>{value}</strong>
      {sub && <p>{sub}</p>}
    </div>
  );
}

/* ─────────────────────── Main page ───────────────────────────── */
type GroupBy = "state" | "ministry" | "sector" | "implementing_agency";
type Category = "state" | "ministry" | "sector" | "implementing_agency" | "status";

export default function AnalyticsPage() {
  const [state, setState] = useState("");
  const [ministry, setMinistry] = useState("");
  const [sector, setSector] = useState("");
  const [agency, setAgency] = useState("");
  const [period, setPeriod] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("implementing_agency");
  const [category, setCategory] = useState<Category>("implementing_agency");
  const [data, setData] = useState<ApiPortfolioAnalytics | null>(null);
  const [riskSummary, setRiskSummary] = useState<ApiRiskSummaryResponse | null>(null);
  const [warningData, setWarningData] = useState<ApiWarningList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      Promise.all([
        getPortfolioAnalytics(
        { reporting_period: period || undefined, state: state || undefined, ministry: ministry || undefined, sector: sector || undefined, implementing_agency: agency || undefined, group_by: groupBy, category },
        { signal: controller.signal }
        ),
        getRiskSummary({ state: state || undefined, ministry: ministry || undefined, sector: sector || undefined, implementing_agency: agency || undefined }, { signal: controller.signal }),
        listWarnings({ page: 1, page_size: 6, state: state || undefined, ministry: ministry || undefined, sector: sector || undefined, implementing_agency: agency || undefined }, { signal: controller.signal }),
      ])
        .then(([portfolio, risk, warnings]) => { setData(portfolio); setRiskSummary(risk); setWarningData(warnings); })
        .catch((reason) => {
          if (!controller.signal.aborted)
            setError(reason instanceof Error ? reason.message : "Analytics could not be loaded.");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [agency, category, groupBy, ministry, period, sector, state]);

  /* ── Derived chart data ── */
  const barData = useMemo(() => {
    if (!data) return [];
    return data.cost.groups
      .filter((g) => toNum(g.derived_escalation_amount) != null)
      .map((g) => ({ label: g.group, value: toNum(g.derived_escalation_amount)! }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [data]);

  const lineData = useMemo(() => {
    if (!data) return [];
    return data.trends.points.map((p) => ({
      x: p.reporting_period,
      y: toNum(p.reported_expenditure),
    }));
  }, [data]);

  const progressTrendData = useMemo(() => {
    if (!data) return [];
    return data.trends.points.map((p) => ({ x: p.reporting_period, y: toNum(p.reported_physical_progress) }));
  }, [data]);

  const costComparisonData = useMemo(() => {
    if (!data) return [];
    return data.cost.groups
      .filter((g) => toNum(g.reported_original_cost) != null && toNum(g.reported_current_cost) != null)
      .map((g) => ({ label: g.group, first: toNum(g.reported_original_cost)!, second: toNum(g.reported_current_cost)! }))
      .sort((a, b) => (b.second - b.first) - (a.second - a.first))
      .slice(0, 8);
  }, [data]);

  const escalationHistData = useMemo(() => {
    if (!data) return [];
    return data.distributions.escalation_histogram.map((b) => ({
      lower: toNum(b.lower) ?? 0,
      upper: toNum(b.upper) ?? 0,
      count: b.count,
    }));
  }, [data]);

  const progressHistData = useMemo(() => {
    if (!data) return [];
    return data.distributions.progress_histogram.map((b) => ({
      lower: toNum(b.lower) ?? 0,
      upper: toNum(b.upper) ?? 0,
      count: b.count,
    }));
  }, [data]);

  const scatterData = useMemo(() => {
    if (!data) return [];
    return data.distributions.scatter
      .filter((p) => toNum(p.physical_progress) != null && toNum(p.expenditure_percentage) != null)
      .map((p) => ({
        x: toNum(p.physical_progress)!,
        y: toNum(p.expenditure_percentage)!,
        label: p.project_name,
        escalation: toNum(p.escalation_percentage),
      }));
  }, [data]);

  const boxData = useMemo(() => {
    if (!data) return [];
    return data.distributions.box_plot
      .filter((g) =>
        toNum(g.minimum) != null &&
        toNum(g.lower_quartile) != null &&
        toNum(g.median) != null &&
        toNum(g.upper_quartile) != null &&
        toNum(g.maximum) != null
      )
      .slice(0, 10)
      .map((g) => ({
        group: g.group,
        min: toNum(g.minimum)!,
        q1: toNum(g.lower_quartile)!,
        median: toNum(g.median)!,
        q3: toNum(g.upper_quartile)!,
        max: toNum(g.maximum)!,
        count: g.count,
      }));
  }, [data]);

  const heatmapGroups = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.trends.heatmap.map((c) => c.group))];
  }, [data]);

  const heatmapPeriods = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.trends.heatmap.map((c) => c.reporting_period))].sort();
  }, [data]);

  const heatCells = useMemo(() => {
    if (!data) return [];
    return data.trends.heatmap.map((c) => ({
      group: c.group,
      period: c.reporting_period,
      value: toNum(c.average_progress),
      count: c.observation_count,
    }));
  }, [data]);

  const benchRows = useMemo(() => data?.benchmarking.rows ?? [], [data]);
  const benchmarkChartData = useMemo(() => benchRows
    .map((row) => ({ label: row.group, value: toNum(row.average_escalation_percentage) }))
    .filter((row): row is { label: string; value: number } => row.value != null)
    .slice(0, 8), [benchRows]);
  const riskComposition = useMemo(() => {
    if (!riskSummary) return [];
    const values = [
      ["Low", riskSummary.summary.low_projects],
      ["Moderate", riskSummary.summary.moderate_projects],
      ["High", riskSummary.summary.high_projects],
      ["Critical", riskSummary.summary.critical_projects],
    ] as const;
    const total = values.reduce((sum, [, count]) => sum + count, 0);
    return total > 0 ? values.filter(([, count]) => count > 0).map(([label, count]) => ({ label, count, percentage: (count / total) * 100 })) : [];
  }, [riskSummary]);
  const riskRankData = useMemo(() => (riskSummary?.summary.top_projects ?? [])
    .filter((project) => project.score != null)
    .slice(0, 8)
    .map((project) => ({ label: project.project_name, value: project.score ?? 0 })), [riskSummary]);
  const attentionItems = warningData?.items ?? [];

  /* ─── Summary metrics ─── */
  const sum = data?.summary;

  return (
    <div className="nd-page">
      {/* ──── Hero ──── */}
      <section className="nd-section nd-hero">
        <div className="nd-container nd-intro-grid">
          <div>
            <p className="nd-eyebrow">Portfolio intelligence / reported register</p>
            <h1 className="nd-title nd-title-small">
              Read the<br />portfolio.
            </h1>
            <p className="nd-lead">
              Real project and reporting-period observations, with derived comparisons clearly marked.
            </p>
          </div>
          <aside className="nd-status-panel">
            <p className="nd-eyebrow">Portfolio scope</p>
            <strong>
              {loading ? "Loading…" : data ? data.summary.project_count.toLocaleString("en-IN") : "—"}
            </strong>
            <p>Projects in current filter scope</p>
          </aside>
        </div>
      </section>

      {/* ──── Filters ──── */}
      <section className="nd-section nd-section-tight">
        <div className="nd-container">
          <div className="nd-analytics-filters">
            <label>
              Reporting period
              <input
                className="nd-input"
                type="month"
                value={period.slice(0, 7)}
                onChange={(e) => setPeriod(e.target.value ? `${e.target.value}-01` : "")}
              />
            </label>
            <label>
              State
              <input className="nd-input" value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
            </label>
            <label>
              Ministry
              <input className="nd-input" value={ministry} onChange={(e) => setMinistry(e.target.value)} placeholder="Ministry" />
            </label>
            <label>
              Sector
              <input className="nd-input" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Sector" />
            </label>
            <label>
              Agency
              <input className="nd-input" value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="Agency" />
            </label>
            <label>
              Compare by
              <select className="nd-select" value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
                <option value="implementing_agency">Agency</option>
                <option value="state">State</option>
                <option value="ministry">Ministry</option>
                <option value="sector">Sector</option>
              </select>
            </label>
            <label>
              Composition
              <select className="nd-select" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                <option value="implementing_agency">Agency</option>
                <option value="state">State</option>
                <option value="ministry">Ministry</option>
                <option value="sector">Sector</option>
                <option value="status">Status</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* ──── Error ──── */}
      {error && (
        <section className="nd-section">
          <div className="nd-container">
            <div className="nd-error">{error}</div>
          </div>
        </section>
      )}

      {/* ──── Loading skeleton ──── */}
      {!error && loading && (
        <section className="nd-section">
          <div className="nd-container">
            <div className="nd-empty">Loading portfolio observations…</div>
          </div>
        </section>
      )}

      {/* ──── Main content ──── */}
      {!error && !loading && data && (
        <>
          {/* 01 Portfolio summary */}
          <section className="nd-section">
            <div className="nd-container">
              <SectionIndex n="01" title="Portfolio summary" />
              <p className="nd-analytics-kicker">What is happening across the current reporting scope: scale, capital committed, cash spent, and reported progress.</p>
              <div className="nd-intelligence-grid">
                <MetricTile label="Total projects" value={fmtInt(sum?.project_count)} sub="Current filter scope" />
                <MetricTile label="Original cost" value={fmtCrore(toNum(sum?.reported_original_cost.value))} sub="Reported value" />
                <MetricTile label="Current cost" value={fmtCrore(toNum(sum?.reported_current_cost.value))} sub="Reported value" />
                <MetricTile label="Expenditure" value={fmtCrore(toNum(sum?.reported_expenditure.value))} sub="Reported value" />
                <MetricTile label="Avg. cost escalation" value={fmtPct(toNum(sum?.derived_cost_escalation_percentage.value))} sub="Derived metric" derived />
                <MetricTile label="Physical progress" value={fmtPct(toNum(sum?.reported_average_progress.value))} sub="Reported value" />
              </div>
            </div>
          </section>

          {/* 02 Cost pressure */}
          <section className="nd-section">
            <div className="nd-container nd-analytics-two-col">
              <div>
                <SectionIndex n="02" title={`Where cost pressure is highest`} />
                <p className="nd-analytics-kicker">Groups ranked by derived escalation amount.</p>
                <ChartCard>
                  {barData.length > 0 ? <HBarChart data={barData} fmt={fmtCrore} /> : <Unavailable reason="No groups have both original and current cost reported." />}
                </ChartCard>
              </div>
              <div>
                <SectionIndex n="03" title="Original versus current cost" />
                <p className="nd-analytics-kicker">The largest available group-level cost comparisons.</p>
                <ChartCard>
                  {costComparisonData.length > 0 ? <ComparisonBars data={costComparisonData} firstLabel="Original" secondLabel="Current" fmt={fmtCrore} /> : <Unavailable reason="No comparable original and current cost data is available." />}
                </ChartCard>
              </div>
            </div>
          </section>

          {/* 04 Cost change */}
          <section className="nd-section">
            <div className="nd-container">
              <SectionIndex n="04" title="How expenditure changes" />
              <p className="nd-analytics-kicker">Reported expenditure by reporting period. Gaps remain gaps; no values are imputed.</p>
              <ChartCard>
                <LineChart data={lineData} yFmt={fmtCrore} yLabel="₹ Crore" />
              </ChartCard>
            </div>
          </section>

          {/* 05 Distributions */}
          <section className="nd-section">
            <div className="nd-container nd-analytics-two-col">
              <div>
                <SectionIndex n="05" title="Cost escalation distribution" />
                <ChartCard style={{ minHeight: 240 }}>
                  <Histogram data={escalationHistData} xLabel="Escalation %" />
                </ChartCard>
              </div>
              <div>
                <SectionIndex n="06" title="Physical progress distribution" />
                <ChartCard>
                  <Histogram data={progressHistData} xLabel="Progress %" />
                </ChartCard>
              </div>
            </div>
          </section>

          {/* 07 Progress movement */}
          <section className="nd-section">
            <div className="nd-container nd-analytics-two-col">
              <div>
                <SectionIndex n="07" title="How physical progress changes" />
                <ChartCard>
                  <LineChart data={progressTrendData} yFmt={fmtPct} yLabel="Progress %" />
                </ChartCard>
              </div>
              <div>
                <SectionIndex n="08" title="Where spend runs ahead of progress" />
                <ChartCard>
                  <ScatterChart
                    data={scatterData}
                    xLabel="Physical progress %"
                    yLabel="Expenditure %"
                  />
                </ChartCard>
              </div>
            </div>
          </section>

          {/* 09 Group comparison */}
          <section className="nd-section">
            <div className="nd-container">
              <SectionIndex n="09" title={`Escalation spread by ${groupBy.replace("_", " ")}`} />
              <ChartCard>
                {boxData.length > 0 ? (
                  <BoxPlotChart data={boxData} />
                ) : (
                  <Unavailable reason="Insufficient grouped escalation data for distribution." />
                )}
              </ChartCard>
            </div>
          </section>

          {/* 10 Heatmap */}
          <section className="nd-section">
            <div className="nd-container">
              <SectionIndex n="10" title="Progress concentration by group and period" />
              {heatCells.length > 0 ? (
                <HeatmapTable cells={heatCells} groups={heatmapGroups} periods={heatmapPeriods} />
              ) : (
                <Unavailable reason="No group × period observation data available." />
              )}
            </div>
          </section>

          {/* 11 Schedule and risk */}
          <section className="nd-section">
            <div className="nd-container nd-analytics-two-col">
              <div>
                <SectionIndex n="11" title="Schedule pressure" />
                <ChartCard>
                  <Unavailable reason="The current analytics API exposes only the aggregate schedule-extension count, not valid date-level distribution or period-level schedule history." />
                </ChartCard>
              </div>
              <div>
                <SectionIndex n="12" title="Risk composition" />
                <ChartCard style={{ minHeight: 240 }}>
                  {riskComposition.length > 0 ? <DonutChart data={riskComposition} /> : <Unavailable reason="No populated risk composition is available for this scope." />}
                </ChartCard>
              </div>
            </div>
          </section>

          {/* 13 Risk concentration */}
          <section className="nd-section">
            <div className="nd-container">
              <SectionIndex n="13" title="Highest-risk projects" />
              <p className="nd-analytics-kicker">Projects ranked by the existing risk summary response. This is a decision-support view, not a new risk calculation.</p>
              <ChartCard>
                {riskRankData.length > 0 ? <div className="nd-risk-ranked"><HBarChart data={riskRankData} fmt={(value) => value.toFixed(1)} /></div> : <Unavailable reason="No populated ranked risk projects are available for this scope." />}
              </ChartCard>
            </div>
          </section>

          {/* 14 Benchmarking table */}
          <section className="nd-section">
            <div className="nd-container">
              <SectionIndex n="14" title="Benchmarking" />
              {benchmarkChartData.length > 0 && <ChartCard style={{ marginBottom: 18 }}><HBarChart data={benchmarkChartData} fmt={fmtPct} /></ChartCard>}
              {benchRows.length > 0 ? (
                <div className="nd-table-wrap">
                  <table className="nd-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>{groupBy.replace("_", " ")}</th>
                        <th>Projects</th>
                        <th>Avg. progress</th>
                        <th>Avg. expenditure</th>
                        <th>Avg. escalation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchRows.slice(0, 20).map((row) => (
                        <tr key={row.group}>
                          <td>{row.rank}</td>
                          <td className="nd-project-name">{row.group}</td>
                          <td>{fmtInt(row.project_count)}</td>
                          <td>{fmtPct(toNum(row.average_progress))}</td>
                          <td>{fmtPct(toNum(row.average_expenditure_percentage))}</td>
                          <td>{fmtPct(toNum(row.average_escalation_percentage))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Unavailable reason="No group data for benchmarking in this filter scope." />
              )}
            </div>
          </section>

          {/* 15 Attention */}
          <section className="nd-section">
            <div className="nd-container">
              <SectionIndex n="15" title="Projects requiring attention" />
              <p className="nd-analytics-kicker">Existing warning records surfaced for the current filter scope.</p>
              {attentionItems.length > 0 ? (
                <div className="nd-attention-grid">
                  {attentionItems.map((warning) => (
                    <article className="nd-attention-item" key={warning.warning_id}>
                      <div className="nd-attention-meta">
                        <span>{warning.severity}</span>
                        <span>{warning.type.replaceAll("_", " ")}</span>
                      </div>
                      <h3 title={warning.project_name}>{warning.project_name}</h3>
                      <p>{warning.message}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <Unavailable reason="No warning records are available for this reporting scope." />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
