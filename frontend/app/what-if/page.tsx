"use client";

import { useEffect, useMemo, useState } from "react";

import { fmtCrore, fmtPct, toNum } from "../../components/charts";
import { assessProjectRiskScenario, listProjects, type ApiProject, type ApiRiskScenarioInput, type ApiRiskScenarioResponse } from "../../lib/api";

const factorLabels: Record<string, string> = {
  cost_escalation: "Cost escalation",
  schedule_extension: "Schedule extension",
  expenditure_progress_divergence: "Expenditure versus physical progress",
  progress_trend: "Reported progress trend",
  data_coverage: "Data coverage",
};

function score(value: number | null) { return value === null ? "Data unavailable" : String(value); }

export default function WhatIfPage() {
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [currentCost, setCurrentCost] = useState("");
  const [expenditure, setExpenditure] = useState("");
  const [progress, setProgress] = useState("");
  const [expectedCompletion, setExpectedCompletion] = useState("");
  const [result, setResult] = useState<ApiRiskScenarioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listProjects({ page: 1, page_size: 100 }, { signal: controller.signal }).then((page) => setProjects(page.items)).catch((reason: unknown) => {
      if ((reason as { name?: string }).name !== "AbortError") setError("Project records could not be loaded for scenario analysis.");
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const project = useMemo(() => projects.find((item) => item.id === selectedId) ?? null, [projects, selectedId]);
  const originalCost = toNum(project?.original_cost);
  const projectCurrentCost = toNum(project?.current_cost);
  const projectExpenditure = toNum(project?.expenditure);
  const projectProgress = toNum(project?.physical_progress);
  const costSupported = originalCost !== null && projectCurrentCost !== null;
  const divergenceSupported = projectCurrentCost !== null && projectExpenditure !== null && projectProgress !== null;
  const scheduleSupported = Boolean(project?.planned_start_date && project.planned_completion_date && project.expected_completion_date);
  const hasChange = Boolean(project) && ((costSupported && currentCost !== "" && Number.isFinite(Number(currentCost)) && Number(currentCost) !== projectCurrentCost) || (divergenceSupported && expenditure !== "" && Number.isFinite(Number(expenditure)) && Number(expenditure) !== projectExpenditure) || (divergenceSupported && progress !== "" && Number.isFinite(Number(progress)) && Number(progress) !== projectProgress) || (scheduleSupported && expectedCompletion !== "" && expectedCompletion !== project?.expected_completion_date?.slice(0, 10)));

  function selectProject(id: string) {
    const next = projects.find((item) => item.id === id) ?? null;
    setSelectedId(id);
    setCurrentCost(next?.current_cost == null ? "" : String(next.current_cost));
    setExpenditure(next?.expenditure == null ? "" : String(next.expenditure));
    setProgress(next?.physical_progress == null ? "" : String(next.physical_progress));
    setExpectedCompletion(next?.expected_completion_date?.slice(0, 10) ?? "");
    setResult(null);
    setError(null);
  }

  async function runScenario() {
    if (!project || !hasChange) return;
    const input: ApiRiskScenarioInput = {};
    if (costSupported && currentCost !== "" && Number(currentCost) !== projectCurrentCost) input.current_cost = Number(currentCost);
    if (divergenceSupported && expenditure !== "" && Number(expenditure) !== projectExpenditure) input.expenditure = Number(expenditure);
    if (divergenceSupported && progress !== "" && Number(progress) !== projectProgress) input.physical_progress = Number(progress);
    if (scheduleSupported && expectedCompletion !== "" && expectedCompletion !== project.expected_completion_date?.slice(0, 10)) input.expected_completion_date = expectedCompletion;
    setRunning(true);
    setError(null);
    try {
      setResult(await assessProjectRiskScenario(project.id, input));
    } catch {
      setError("The scenario could not be evaluated with the current risk logic.");
    } finally {
      setRunning(false);
    }
  }

  return <main className="nd-page">
    <section className="nd-section nd-hero"><div className="nd-container nd-intro-grid"><div><p className="nd-eyebrow">Scenario / What-If</p><h1 className="nd-title nd-title-small">Test the current risk logic.</h1><p className="nd-lead">Illustrative impact using the current deterministic risk logic. Scenario values are evaluated in memory and never change reported project data.</p></div><aside className="nd-status-panel"><p className="nd-eyebrow">Interpretation</p><strong>Not a forecast</strong><p>Results show how transparent operational thresholds respond to supported input changes.</p></aside></div></section>
    <section className="nd-section"><div className="nd-container">
      {error && <div className="nd-error">{error}</div>}
      {loading ? <div className="nd-empty">Loading projects with reported scenario inputs...</div> : <div className="nd-wi-layout"><div><label className="nd-wi-label" htmlFor="scenario-project">Project</label><select id="scenario-project" className="nd-wi-select" value={selectedId} onChange={(event) => selectProject(event.target.value)}><option value="">Select a project</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name ?? item.project_code ?? item.id}</option>)}</select>
        {project && <div className="nd-wi-inputs"><div><label className="nd-wi-label" htmlFor="scenario-cost">Scenario current cost</label><input id="scenario-cost" className="nd-wi-input" type="number" min="0" step="0.01" value={currentCost} disabled={!costSupported} onChange={(event) => setCurrentCost(event.target.value)} />{!costSupported && <small>Data unavailable: reported original and current cost are both required.</small>}</div><div><label className="nd-wi-label" htmlFor="scenario-expenditure">Scenario expenditure</label><input id="scenario-expenditure" className="nd-wi-input" type="number" min="0" step="0.01" value={expenditure} disabled={!divergenceSupported} onChange={(event) => setExpenditure(event.target.value)} />{!divergenceSupported && <small>Data unavailable: reported current cost, expenditure and physical progress are required.</small>}</div><div><label className="nd-wi-label" htmlFor="scenario-progress">Scenario physical progress</label><input id="scenario-progress" className="nd-wi-input" type="number" min="0" max="100" step="0.01" value={progress} disabled={!divergenceSupported} onChange={(event) => setProgress(event.target.value)} />{!divergenceSupported && <small>Data unavailable: reported current cost, expenditure and physical progress are required.</small>}</div><div><label className="nd-wi-label" htmlFor="scenario-date">Scenario expected completion</label><input id="scenario-date" className="nd-wi-input" type="date" value={expectedCompletion} disabled={!scheduleSupported} onChange={(event) => setExpectedCompletion(event.target.value)} />{!scheduleSupported && <small>Data unavailable: planned start, planned completion and expected completion dates are required.</small>}</div></div>
        }<button type="button" className="nd-wi-button" disabled={!hasChange || running} onClick={() => void runScenario()}>{running ? "Evaluating..." : "Evaluate scenario"}</button></div>
        <aside className="nd-wi-evidence"><p className="nd-eyebrow">Reported baseline</p>{project ? <><strong>{project.name ?? project.project_code ?? "Selected project"}</strong><p>Original cost: {originalCost === null ? "Data unavailable" : fmtCrore(originalCost)}</p><p>Current cost: {projectCurrentCost === null ? "Data unavailable" : fmtCrore(projectCurrentCost)}</p><p>Expenditure: {projectExpenditure === null ? "Data unavailable" : fmtCrore(projectExpenditure)}</p><p>Physical progress: {projectProgress === null ? "Data unavailable" : fmtPct(projectProgress)}</p></> : <p>Select a project to view supported scenario inputs.</p>}</aside></div>}
    </div></section>
    {result && <section className="nd-section"><div className="nd-container"><p className="nd-eyebrow">Scenario result</p><h2 className="nd-section-title">Risk-logic comparison</h2><div className="nd-wi-results"><div><span>Baseline risk</span><strong>{score(result.baseline.score)}</strong><small>{result.baseline.level} · {result.baseline.availability.replaceAll("_", " ")}</small></div><div><span>Scenario risk</span><strong>{score(result.scenario.score)}</strong><small>{result.scenario.level} · {result.scenario.availability.replaceAll("_", " ")}</small></div><div><span>Changed factors</span><strong>{result.changed_factors.length}</strong><small>{result.changed_factors.length ? result.changed_factors.map((factor) => factorLabels[factor] ?? factor).join(", ") : "No scored factor changed"}</small></div></div><div className="nd-wi-explanation"><strong>Illustrative impact</strong><p>{result.explanation}</p><p>{result.scenario.explanation}</p></div></div></section>}
    <style>{styles}</style>
  </main>;
}

const styles = `
.nd-wi-layout { display:grid; grid-template-columns:minmax(0,2fr) minmax(250px,1fr); gap:46px; }
.nd-wi-label { display:block; margin:0 0 7px; color:var(--muted); font-size:.7rem; letter-spacing:.08em; text-transform:uppercase; }
.nd-wi-select,.nd-wi-input { box-sizing:border-box; width:100%; min-height:42px; border:1px solid var(--line); border-radius:0; background:var(--white); color:var(--ink); padding:9px 10px; font:inherit; }
.nd-wi-inputs { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin:24px 0; }
.nd-wi-inputs small { display:block; margin-top:6px; color:var(--muted); font-size:.72rem; line-height:1.4; }
.nd-wi-button { border:1px solid var(--ink); border-radius:0; background:var(--ink); color:var(--white); padding:11px 16px; cursor:pointer; font:600 .78rem var(--sans); letter-spacing:.05em; text-transform:uppercase; }
.nd-wi-button:disabled { cursor:not-allowed; opacity:.5; }
.nd-wi-evidence { border-left:2px solid var(--orange); padding:7px 0 7px 20px; align-self:start; }
.nd-wi-evidence strong { display:block; font:400 1.4rem var(--serif); }
.nd-wi-evidence p { margin:9px 0 0; color:var(--muted); font-size:.82rem; }
.nd-wi-results { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border-top:2px solid var(--ink); }
.nd-wi-results > div { min-height:120px; padding:18px 20px; border-right:1px solid var(--line); background:var(--white); }
.nd-wi-results > div:last-child { border-right:0; }
.nd-wi-results span,.nd-wi-results small { display:block; color:var(--muted); font-size:.72rem; line-height:1.4; }
.nd-wi-results strong { display:block; margin:11px 0 8px; font:400 1.7rem var(--serif); }
.nd-wi-explanation { margin-top:22px; border-left:2px solid var(--orange); padding:4px 0 4px 18px; }
.nd-wi-explanation p { margin:7px 0 0; color:var(--muted); line-height:1.5; }
.nd-section-title { margin:6px 0 18px; font:400 1.45rem var(--serif); }
@media (max-width:760px) { .nd-wi-layout { grid-template-columns:1fr; } .nd-wi-inputs,.nd-wi-results { grid-template-columns:1fr; } .nd-wi-results > div { border-right:0; border-bottom:1px solid var(--line); } }
`;
