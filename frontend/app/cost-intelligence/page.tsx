"use client";

import { useEffect, useMemo, useState } from "react";

import { ChartCard, ComparisonBars, HBarChart, LineChart, Unavailable, fmtCrore, fmtPct, toNum } from "../../components/charts";
import { getPortfolioAnalytics, type ApiPortfolioAnalytics } from "../../lib/api";

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="nd-ci-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

export default function CostIntelligencePage() {
  const [analytics, setAnalytics] = useState<ApiPortfolioAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getPortfolioAnalytics({}, { signal: controller.signal }).then(setAnalytics).catch((reason: unknown) => {
      if ((reason as { name?: string }).name !== "AbortError") setError("Portfolio cost data could not be loaded.");
    });
    return () => controller.abort();
  }, []);

  const groups = useMemo(() => (analytics?.cost.groups ?? []).map((group) => {
    const original = toNum(group.reported_original_cost);
    const current = toNum(group.reported_current_cost);
    return original === null || current === null ? null : { label: group.group, first: original, second: current };
  }).filter((value): value is { label: string; first: number; second: number } => value !== null), [analytics]);
  const costTrend = useMemo(() => (analytics?.trends.points ?? []).map((point) => ({ x: point.reporting_period, y: toNum(point.reported_current_cost) })), [analytics]);
  const pressure = useMemo(() => (analytics?.distributions.scatter ?? []).map((point) => ({ label: point.project_name, value: toNum(point.escalation_percentage) })).filter((point): point is { label: string; value: number } => point.value !== null).filter((point) => point.value > 0).sort((left, right) => right.value - left.value).slice(0, 10), [analytics]);
  const summary = analytics?.summary;

  return <main className="nd-page">
    <section className="nd-section nd-hero"><div className="nd-container nd-intro-grid"><div><p className="nd-eyebrow">Cost intelligence</p><h1 className="nd-title nd-title-small">Read cost from reported evidence.</h1><p className="nd-lead">Portfolio cost, expenditure and escalation are drawn from the current analytics API. Derived values are marked by their calculation basis.</p></div><aside className="nd-status-panel"><p className="nd-eyebrow">Portfolio scope</p><strong>{analytics ? `${summary?.project_count ?? "Data unavailable"} projects` : "Loading evidence"}</strong><p>Only projects with the required reported fields contribute to each metric.</p></aside></div></section>
    <section className="nd-section"><div className="nd-container">
      {error ? <div className="nd-error">{error}</div> : !analytics ? <div className="nd-empty">Loading portfolio cost observations...</div> : <div className="nd-ci-metrics">
        <Metric label="Reported original cost" value={summary?.reported_original_cost.available ? fmtCrore(toNum(summary.reported_original_cost.value)) : "Data unavailable"} note="Reported project baseline" />
        <Metric label="Reported current cost" value={summary?.reported_current_cost.available ? fmtCrore(toNum(summary.reported_current_cost.value)) : "Data unavailable"} note="Reported revised/current value" />
        <Metric label="Reported expenditure" value={summary?.reported_expenditure.available ? fmtCrore(toNum(summary.reported_expenditure.value)) : "Data unavailable"} note="Reported portfolio expenditure" />
        <Metric label="Derived escalation" value={summary?.derived_cost_escalation_percentage.available ? fmtPct(toNum(summary.derived_cost_escalation_percentage.value)) : "Data unavailable"} note="Change against reported original cost" />
      </div>}
    </div></section>
    {analytics && <><section className="nd-section"><div className="nd-container nd-analytics-two-col"><div><p className="nd-eyebrow">Comparison</p><h2 className="nd-section-title">Reported cost by {analytics.cost.group_by.replaceAll("_", " ")}</h2><ChartCard>{groups.length ? <ComparisonBars data={groups.slice(0, 12)} firstLabel="Original" secondLabel="Current" fmt={fmtCrore} /> : <Unavailable reason={analytics.cost.notice.reason ?? "Original and current costs are not both available by group."} />}</ChartCard></div><div><p className="nd-eyebrow">History</p><h2 className="nd-section-title">Reported current-cost observations</h2><ChartCard>{costTrend.filter((point) => point.y !== null).length >= 2 ? <LineChart data={costTrend} yFmt={fmtCrore} yLabel="Reported cost" /> : <Unavailable reason="At least two reported cost-history periods are required for a portfolio trend." />}</ChartCard></div></div></section>
    <section className="nd-section"><div className="nd-container"><p className="nd-eyebrow">Attention</p><h2 className="nd-section-title">Projects with reported cost escalation</h2><p className="nd-analytics-kicker">Ranked by derived escalation percentage from projects that report both original and current cost. This is a cost-pressure signal, not a causal finding.</p><ChartCard>{pressure.length ? <HBarChart data={pressure} fmt={fmtPct} /> : <Unavailable reason="No project reports both original and current cost values with positive escalation." />}</ChartCard></div></section></>}
    <style>{styles}</style>
  </main>;
}

const styles = `
.nd-ci-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); border-top:2px solid var(--ink); }
.nd-ci-metric { min-height:128px; padding:18px 20px; border-right:1px solid var(--line); background:var(--white); }
.nd-ci-metric:last-child { border-right:0; }
.nd-ci-metric span,.nd-ci-metric small { display:block; color:var(--muted); font-size:.72rem; line-height:1.4; }
.nd-ci-metric strong { display:block; margin:11px 0 8px; font:400 1.55rem var(--serif); color:var(--ink); }
.nd-section-title { margin:6px 0 18px; font:400 1.45rem var(--serif); }
@media (max-width:800px) { .nd-ci-metrics { grid-template-columns:1fr 1fr; } .nd-ci-metric:nth-child(2) { border-right:0; } .nd-ci-metric:nth-child(-n+2) { border-bottom:1px solid var(--line); } }
@media (max-width:480px) { .nd-ci-metrics { grid-template-columns:1fr; } .nd-ci-metric { border-right:0; border-bottom:1px solid var(--line); } }
`;
