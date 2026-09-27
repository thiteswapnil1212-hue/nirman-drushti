"use client";

import { useEffect, useMemo, useState } from "react";

import { ChartCard, Histogram, LineChart, ScatterChart, Unavailable, fmtPct, toNum } from "../../components/charts";
import { getPortfolioAnalytics, type ApiPortfolioAnalytics } from "../../lib/api";

function ProgressMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="nd-pi-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

export default function ProgressIntelligencePage() {
  const [analytics, setAnalytics] = useState<ApiPortfolioAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getPortfolioAnalytics({}, { signal: controller.signal }).then(setAnalytics).catch((reason: unknown) => {
      if ((reason as { name?: string }).name !== "AbortError") setError("Portfolio progress data could not be loaded.");
    });
    return () => controller.abort();
  }, []);

  const progressTrend = useMemo(() => (analytics?.trends.points ?? []).map((point) => ({ x: point.reporting_period, y: toNum(point.reported_physical_progress) })), [analytics]);
  const scatter = useMemo(() => (analytics?.distributions.scatter ?? []).map((point) => {
    const progress = toNum(point.physical_progress);
    const expenditure = toNum(point.expenditure_percentage);
    return progress === null || expenditure === null ? null : { x: progress, y: expenditure, label: point.project_name, escalation: toNum(point.escalation_percentage) };
  }).filter((value): value is { x: number; y: number; label: string; escalation: number | null } => value !== null), [analytics]);
  const divergence = useMemo(() => scatter.map((point) => ({ ...point, gap: point.y - point.x })).filter((point) => point.gap > 10).sort((left, right) => right.gap - left.gap).slice(0, 15), [scatter]);
  const summary = analytics?.summary;

  return <main className="nd-page">
    <section className="nd-section nd-hero"><div className="nd-container nd-intro-grid"><div><p className="nd-eyebrow">Progress intelligence</p><h1 className="nd-title nd-title-small">Follow reported physical work.</h1><p className="nd-lead">Physical progress describes what has been reported. It is presented separately from operational risk and does not determine a project’s risk level.</p></div><aside className="nd-status-panel"><p className="nd-eyebrow">Portfolio scope</p><strong>{analytics ? `${summary?.projects_with_progress ?? "Data unavailable"} reported` : "Loading evidence"}</strong><p>Projects with reported physical-progress observations in the current scope.</p></aside></div></section>
    <section className="nd-section"><div className="nd-container">{error ? <div className="nd-error">{error}</div> : !analytics ? <div className="nd-empty">Loading reported physical-progress observations...</div> : <div className="nd-pi-metrics"><ProgressMetric label="Average reported physical progress" value={summary?.reported_average_progress.available ? fmtPct(toNum(summary.reported_average_progress.value)) : "Data unavailable"} note="Average of available project reports" /><ProgressMetric label="Reported expenditure percentage" value={summary?.derived_expenditure_percentage.available ? fmtPct(toNum(summary.derived_expenditure_percentage.value)) : "Data unavailable"} note="Derived from reported expenditure and current cost" /><ProgressMetric label="Projects with progress" value={String(summary?.projects_with_progress ?? "Data unavailable")} note="Projects contributing a physical-progress value" /></div>}</div></section>
    {analytics && <><section className="nd-section"><div className="nd-container nd-analytics-two-col"><div><p className="nd-eyebrow">History</p><h2 className="nd-section-title">Reported progress by reporting period</h2><ChartCard>{progressTrend.filter((point) => point.y !== null).length >= 2 ? <LineChart data={progressTrend} yFmt={fmtPct} yLabel="Reported physical progress" /> : <Unavailable reason="At least two reporting-period observations are required for a portfolio progress trend." />}</ChartCard></div><div><p className="nd-eyebrow">Distribution</p><h2 className="nd-section-title">Reported physical-progress spread</h2><ChartCard>{analytics.distributions.progress_histogram.length ? <Histogram data={analytics.distributions.progress_histogram.map((bin) => ({ lower: Number(bin.lower), upper: Number(bin.upper), count: bin.count }))} xLabel="Reported physical progress (%)" /> : <Unavailable reason={analytics.distributions.notice.reason ?? "No reported physical-progress distribution is available."} />}</ChartCard></div></div></section>
    <section className="nd-section"><div className="nd-container"><p className="nd-eyebrow">Relationship</p><h2 className="nd-section-title">Reported expenditure versus physical progress</h2><p className="nd-analytics-kicker">Each point uses a project reporting both values. The comparison is an operational attention signal only; it does not establish cause, efficiency, or project risk.</p><ChartCard>{scatter.length ? <ScatterChart data={scatter} xLabel="Reported physical progress" yLabel="Reported expenditure percentage" /> : <Unavailable reason="No projects report both physical progress and expenditure percentage." />}</ChartCard></div></section>
    <section className="nd-section"><div className="nd-container"><p className="nd-eyebrow">Attention</p><h2 className="nd-section-title">Reported expenditure ahead of physical progress</h2>{divergence.length ? <div className="nd-table-wrap"><table className="nd-table"><thead><tr><th>Project</th><th>Physical progress</th><th>Expenditure</th><th>Difference</th></tr></thead><tbody>{divergence.map((point) => <tr key={point.label}><td>{point.label}</td><td>{fmtPct(point.x)}</td><td>{fmtPct(point.y)}</td><td>{fmtPct(point.gap)}</td></tr>)}</tbody></table></div> : <Unavailable reason="No project has a reported expenditure percentage more than 10 percentage points above reported physical progress." />}</div></section>
    <section className="nd-section"><div className="nd-container"><div className="nd-unavailable-compact"><div><strong>Data unavailable: schedule baseline</strong><p>The current portfolio analytics response does not provide valid expected-progress or date-level schedule history for a schedule-performance chart. No expected-progress proxy is shown.</p></div></div></div></section></>}
    <style>{styles}</style>
  </main>;
}

const styles = `
.nd-pi-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border-top:2px solid var(--ink); }
.nd-pi-metric { min-height:128px; padding:18px 20px; border-right:1px solid var(--line); background:var(--white); }
.nd-pi-metric:last-child { border-right:0; }
.nd-pi-metric span,.nd-pi-metric small { display:block; color:var(--muted); font-size:.72rem; line-height:1.4; }
.nd-pi-metric strong { display:block; margin:11px 0 8px; font:400 1.55rem var(--serif); color:var(--ink); }
.nd-section-title { margin:6px 0 18px; font:400 1.45rem var(--serif); }
@media (max-width:720px) { .nd-pi-metrics { grid-template-columns:1fr; } .nd-pi-metric { border-right:0; border-bottom:1px solid var(--line); } }
`;
