"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listWarnings, type ApiEarlyWarning, type ApiWarningList, type ApiWarningSeverity, type ApiWarningType } from "@/lib/api";

const severityClass = (severity: string) => `nd-warning-severity nd-warning-${severity.toLowerCase()}`;
const evidenceLabel = (source: ApiEarlyWarning["source_type"]) => source === "DATA_QUALITY" ? "DATA QUALITY" : source;

export default function EarlyWarningsPage() {
  const [severity, setSeverity] = useState<ApiWarningSeverity | "">("");
  const [warningType, setWarningType] = useState<ApiWarningType | "">("");
  const [state, setState] = useState("");
  const [ministry, setMinistry] = useState("");
  const [sector, setSector] = useState("");
  const [agency, setAgency] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiWarningList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      listWarnings({ severity: severity || undefined, warning_type: warningType || undefined, state, ministry, sector, implementing_agency: agency, page, page_size: 50 }, { signal: controller.signal }).then(setData).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Warnings could not be loaded."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [agency, ministry, page, sector, severity, state, warningType]);

  const updateFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  const totalPages = Math.max(1, Math.ceil((data?.summary.total ?? 0) / 50));

  return <div className="nd-page"><section className="nd-section nd-hero"><div className="nd-container nd-intro-grid"><div><p className="nd-eyebrow">Early warnings / evidence ledger</p><h1 className="nd-title nd-title-small">Signals for<br />attention.</h1><p className="nd-lead">Deterministic notices from reported project and history observations. No prediction or causal claim is made.</p></div><aside className="nd-status-panel"><p className="nd-eyebrow">Warning ledger</p><strong>{loading ? "Loading" : data ? data.summary.total.toLocaleString("en-IN") : "Data unavailable"}</strong><p>Active evidence-backed notices</p></aside></div></section>
    <section className="nd-section nd-section-tight"><div className="nd-container"><div className="nd-analytics-filters"><label>Severity<select className="nd-select" value={severity} onChange={(event) => { setSeverity(event.target.value as typeof severity); setPage(1); }}><option value="">All severities</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MODERATE">Moderate</option><option value="INFO">Info</option></select></label><label>Warning type<select className="nd-select" value={warningType} onChange={(event) => { setWarningType(event.target.value as typeof warningType); setPage(1); }}><option value="">All warning types</option><option value="COST_ESCALATION">Cost escalation</option><option value="SCHEDULE_EXTENSION">Schedule extension</option><option value="EXPENDITURE_PROGRESS_DIVERGENCE">Expenditure / progress</option><option value="PROGRESS_SLOWDOWN">Progress slowdown</option><option value="DATA_QUALITY">Data quality</option></select></label><label>State<input className="nd-input" value={state} onChange={(event) => updateFilter(setState, event.target.value)} placeholder="State" /></label><label>Ministry<input className="nd-input" value={ministry} onChange={(event) => updateFilter(setMinistry, event.target.value)} placeholder="Ministry" /></label><label>Sector<input className="nd-input" value={sector} onChange={(event) => updateFilter(setSector, event.target.value)} placeholder="Sector" /></label><label>Agency<input className="nd-input" value={agency} onChange={(event) => updateFilter(setAgency, event.target.value)} placeholder="Agency" /></label></div></div></section>
    <section className="nd-section"><div className="nd-container">{error ? <div className="nd-error">{error}</div> : !data && loading ? <div className="nd-empty">Loading warning observations...</div> : data ? <><div className="nd-section-index"><span>01</span><h2>Warning summary</h2></div><div className="nd-ledger nd-warning-ledger"><div className="nd-ledger-item"><p className="nd-label">Critical</p><strong>{data.summary.critical}</strong><p>Immediate review</p></div><div className="nd-ledger-item"><p className="nd-label">High</p><strong>{data.summary.high}</strong><p>Priority review</p></div><div className="nd-ledger-item"><p className="nd-label">Moderate</p><strong>{data.summary.moderate}</strong><p>Monitor evidence</p></div><div className="nd-ledger-item"><p className="nd-label">Info</p><strong>{data.summary.info}</strong><p>Data-quality notice</p></div></div></> : null}</div></section>
    <section className="nd-section"><div className="nd-container"><div className="nd-section-index"><span>02</span><h2>Warning ledger</h2></div>{data?.items.length ? <><div className="nd-warning-list">{data.items.map((warning) => <article className="nd-warning-item" key={warning.warning_id}><div className="nd-warning-head"><span className={severityClass(warning.severity)}>{warning.severity}</span><span className="nd-warning-source">{evidenceLabel(warning.source_type)}</span><span className="nd-warning-type">{warning.type.replaceAll("_", " ")}</span></div><div className="nd-warning-body"><div><Link href={`/projects/${warning.project_id}`} className="nd-project-name">{warning.project_name}</Link><h3>{warning.title}</h3><p>{warning.message}</p></div><div className="nd-warning-evidence"><p className="nd-label">Evidence</p>{Object.entries(warning.evidence.values).map(([key, value]) => <div key={key}><span>{key.replaceAll("_", " ")}</span><b>{value === null ? "Not available" : String(value)}</b></div>)}</div><div className="nd-warning-action"><p className="nd-label">Recommended attention</p><p>{warning.recommended_action}</p></div></div></article>)}</div><div className="nd-pagination"><span>{(page - 1) * 50 + 1}-{Math.min(page * 50, data.summary.total)} of {data.summary.total}</span><div className="nd-pagination-actions"><button className="nd-icon-button" aria-label="Previous warnings" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button><span>{page} / {totalPages}</span><button className="nd-icon-button" aria-label="Next warnings" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div></div></> : <div className="nd-unavailable"><div><strong>Data unavailable</strong><p>No warnings match the current scope, or there are insufficient reported observations.</p></div></div>}</div></section>
    {data && <section className="nd-section"><div className="nd-container"><div className="nd-unavailable-compact"><div><strong>Evidence classification</strong><p>REPORTED values come from source records. DERIVED values are transparent calculations. DATA QUALITY notices describe incomplete coverage and do not imply project risk.</p></div></div></div></section>}
  </div>;
}
