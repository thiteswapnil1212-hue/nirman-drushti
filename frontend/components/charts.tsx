"use client";

import type { ReactNode } from "react";

/* ─── Formatting helpers ─────────────────────────────────────────── */

export function fmtCrore(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)} L Cr`;
  if (abs >= 1_000) return `₹${(v / 1_000).toFixed(1)} K Cr`;
  return `₹${v.toFixed(1)} Cr`;
}

export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(decimals)}%`;
}

export function fmtInt(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return Math.round(v).toLocaleString("en-IN");
}

export function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* ─── Unavailable state ─────────────────────────────────────────── */

export function Unavailable({ reason }: { reason?: string }) {
  return (
    <div className="ch-unavailable">
      <span>Data unavailable for this reporting scope</span>
      {reason && <small>{reason}</small>}
    </div>
  );
}

/* ─── Section label ─────────────────────────────────────────────── */
export function SectionIndex({ n, title }: { n: string; title: string }) {
  return (
    <div className="nd-section-index" style={{ marginBottom: 20 }}>
      <span>{n}</span>
      <h2>{title}</h2>
    </div>
  );
}

/* ─── Chart shell ────────────────────────────────────────────────── */
export function ChartCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="ch-card" style={style}>
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   BAR CHART (horizontal)
   groups: { label, value }[]  — sorted descending by caller
────────────────────────────────────────────────────────────────────── */
interface BarDatum {
  label: string;
  value: number;
  subLabel?: string;
}

export function HBarChart({
  data,
  fmt,
  height = 32,
  accent = "var(--orange)",
}: {
  data: BarDatum[];
  fmt: (v: number) => string;
  height?: number;
  accent?: string;
}) {
  if (!data.length) return <Unavailable />;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="ch-hbar-list">
      {data.map((d) => {
        const pct = Math.max(2, (d.value / maxVal) * 100);
        return (
          <div key={d.label} className="ch-hbar-row" style={{ minHeight: height }}>
            <div className="ch-hbar-label" title={d.label}>
              {d.label}
            </div>
            <div className="ch-hbar-track">
              <div
                className="ch-hbar-fill"
                style={{ width: `${pct}%`, background: accent }}
                title={fmt(d.value)}
              />
            </div>
            <div className="ch-hbar-value">{fmt(d.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

interface ComparisonDatum {
  label: string;
  first: number;
  second: number;
}

export function ComparisonBars({
  data,
  firstLabel,
  secondLabel,
  fmt,
}: {
  data: ComparisonDatum[];
  firstLabel: string;
  secondLabel: string;
  fmt: (v: number) => string;
}) {
  if (!data.length) return <Unavailable />;
  const maxValue = Math.max(...data.flatMap((d) => [d.first, d.second]), 1);
  return (
    <div className="ch-comparison-list">
      <div className="ch-comparison-legend">
        <span><i className="ch-comparison-swatch ch-comparison-first" />{firstLabel}</span>
        <span><i className="ch-comparison-swatch ch-comparison-second" />{secondLabel}</span>
      </div>
      {data.map((d) => (
        <div className="ch-comparison-row" key={d.label}>
          <div className="ch-comparison-label" title={d.label}>{d.label}</div>
          <div className="ch-comparison-bars">
            <div className="ch-comparison-track" title={`${firstLabel}: ${fmt(d.first)}`}>
              <div className="ch-comparison-fill ch-comparison-first" style={{ width: `${Math.max(2, (d.first / maxValue) * 100)}%` }} />
            </div>
            <div className="ch-comparison-track" title={`${secondLabel}: ${fmt(d.second)}`}>
              <div className="ch-comparison-fill ch-comparison-second" style={{ width: `${Math.max(2, (d.second / maxValue) * 100)}%` }} />
            </div>
          </div>
          <div className="ch-comparison-values"><span>{fmt(d.first)}</span><span>{fmt(d.second)}</span></div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   LINE CHART
   points: { x: string; y: number | null }[]
────────────────────────────────────────────────────────────────────── */
interface LinePoint {
  x: string;
  y: number | null;
}

export function LineChart({
  data,
  yFmt,
  yLabel,
}: {
  data: LinePoint[];
  yFmt: (v: number) => string;
  yLabel?: string;
}) {
  const valid = data.filter((d) => d.y != null);
  if (valid.length < 2) return <Unavailable reason="Need at least two reporting-period observations." />;

  const W = 700;
  const H = 220;
  const PAD = { top: 18, right: 18, bottom: 46, left: 72 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const ys = valid.map((d) => d.y as number);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys, yMin + 1);

  const scaleX = (i: number) =>
    PAD.left + (i / Math.max(1, data.length - 1)) * plotW;
  const scaleY = (v: number) =>
    PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Only draw line through non-null points
  const lineSegments: string[] = [];
  let seg = "";
  data.forEach((d, i) => {
    if (d.y == null) { if (seg) { lineSegments.push(seg); seg = ""; } return; }
    const x = scaleX(i);
    const y = scaleY(d.y);
    seg += seg ? ` L${x},${y}` : `M${x},${y}`;
  });
  if (seg) lineSegments.push(seg);

  // Y-axis ticks
  const TICKS = 5;
  const yTicks = Array.from({ length: TICKS }, (_, i) =>
    yMin + ((yMax - yMin) * i) / (TICKS - 1)
  );

  // X labels — show only ~6 even spread
  const step = Math.max(1, Math.ceil(data.length / 6));
  const xLabelIndices = data.reduce<number[]>(
    (acc, _, i) => (i % step === 0 || i === data.length - 1 ? [...acc, i] : acc),
    []
  );

  return (
    <div className="ch-svg-wrap">
      {yLabel && <div className="ch-axis-label-y">{yLabel}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="ch-svg" aria-label="Line chart">
        {/* Grid + Y axis ticks */}
        {yTicks.map((v, i) => {
          const y = scaleY(v);
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} className="ch-grid" />
              <text x={PAD.left - 6} y={y + 4} className="ch-axis-text" textAnchor="end">
                {yFmt(v)}
              </text>
            </g>
          );
        })}

        {/* X axis line */}
        <line
          x1={PAD.left}
          y1={H - PAD.bottom}
          x2={W - PAD.right}
          y2={H - PAD.bottom}
          className="ch-axis"
        />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} className="ch-axis" />

        {/* X labels */}
        {xLabelIndices.map((i) => (
          <text
            key={i}
            x={scaleX(i)}
            y={H - PAD.bottom + 14}
            className="ch-axis-text"
            textAnchor="middle"
          >
            {data[i].x.slice(0, 7)}
          </text>
        ))}

        {/* Line path(s) */}
        {lineSegments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--orange)" strokeWidth={2.5} />
        ))}

        {/* Data points with tooltips */}
        {data.map((d, i) =>
          d.y != null ? (
            <circle
              key={i}
              cx={scaleX(i)}
              cy={scaleY(d.y)}
              r={4}
              fill="var(--orange)"
              stroke="var(--white)"
              strokeWidth={1.5}
            >
              <title>{`${data[i].x.slice(0, 7)}: ${yFmt(d.y)}`}</title>
            </circle>
          ) : null
        )}
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   DONUT / PIE CHART
────────────────────────────────────────────────────────────────────── */
const PALETTE = ["var(--orange)", "var(--ink)", "#8c7166", "#b9a79d", "#d7c8bf", "#aaa09a", "#c4b8b0", "#e8ddd6"];

interface DonutSlice {
  label: string;
  count: number;
  percentage: number;
}

export function DonutChart({ data }: { data: DonutSlice[] }) {
  if (!data.length) return <Unavailable />;
  const total = data.reduce((s, d) => s + d.count, 0);
  const CX = 56; const CY = 56; const R = 42;
  const circumference = 2 * Math.PI * R;
  const slices = data.slice(0, 8);
  // Pre-compute cumulative offsets to avoid mutation inside JSX
  const offsets = slices.reduce<number[]>((acc, d) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
    return [...acc, prev + (d.percentage / 100) * circumference];
  }, []);

  return (
    <div className="ch-donut-wrap">
      <svg
        viewBox="0 0 112 112"
        className="ch-donut-svg"
        role="img"
        aria-label="Portfolio composition"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--warm)" strokeWidth={14} />
        {slices.map((d, i) => {
          const len = (d.percentage / 100) * circumference;
          const startOffset = i === 0 ? 0 : offsets[i - 1];
          return (
            <circle
              key={d.label}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={14}
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={-startOffset}
            >
              <title>{`${d.label}: ${d.count} (${d.percentage.toFixed(1)}%)`}</title>
            </circle>
          );
        })}
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          style={{ transform: "rotate(90deg)", transformOrigin: "center", fontFamily: "var(--serif)", fontSize: 14, fill: "var(--ink)" }}
        >
          {total.toLocaleString("en-IN")}
        </text>
        <text
          x={CX}
          y={CY + 10}
          textAnchor="middle"
          style={{ transform: "rotate(90deg)", transformOrigin: "center", fontFamily: "var(--serif)", fontSize: 6.5, fill: "var(--muted)" }}
        >
          projects
        </text>
      </svg>
      <div className="ch-legend">
        {data.slice(0, 8).map((d, i) => (
          <div key={d.label} className="ch-legend-row">
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            <span title={d.label}>{d.label}</span>
            <b>{fmtPct(d.percentage)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   HISTOGRAM
────────────────────────────────────────────────────────────────────── */
interface HistBin {
  lower: number;
  upper: number;
  count: number;
}

export function Histogram({ data, xLabel }: { data: HistBin[]; xLabel?: string }) {
  if (!data.length || data.every((b) => b.count === 0))
    return <Unavailable reason="Not enough observations for a distribution." />;
  const maxCount = Math.max(...data.map((b) => b.count), 1);

  const W = 560;
  const H = 200;
  const PAD = { top: 12, right: 12, bottom: 52, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const binW = plotW / data.length;

  const TICKS = 4;
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) =>
    Math.round((maxCount * i) / TICKS)
  );

  return (
    <div className="ch-svg-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="ch-svg" aria-label="Histogram">
        {/* grid */}
        {yTicks.map((v, i) => {
          const y = PAD.top + plotH - (v / maxCount) * plotH;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} className="ch-grid" />
              <text x={PAD.left - 4} y={y + 4} className="ch-axis-text" textAnchor="end">
                {fmtInt(v)}
              </text>
            </g>
          );
        })}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} className="ch-axis" />
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} className="ch-axis" />

        {data.map((b, i) => {
          const barH = Math.max(2, (b.count / maxCount) * plotH);
          const x = PAD.left + i * binW + 2;
          const y = PAD.top + plotH - barH;
          const label = `${b.lower.toFixed(0)}–${b.upper.toFixed(0)}`;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={binW - 4}
                height={barH}
                fill="var(--orange)"
                opacity={0.85}
              >
                <title>{`${label}: ${b.count} projects`}</title>
              </rect>
              <text
                x={x + (binW - 4) / 2}
                y={H - PAD.bottom + 12}
                className="ch-axis-text"
                textAnchor="middle"
                fontSize={8}
              >
                {b.lower.toFixed(0)}
              </text>
            </g>
          );
        })}
        {xLabel && (
          <text
            x={W / 2}
            y={H - 4}
            className="ch-axis-text"
            textAnchor="middle"
            fontSize={9}
          >
            {xLabel}
          </text>
        )}
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   SCATTER CHART
────────────────────────────────────────────────────────────────────── */
interface ScatterPoint {
  x: number;
  y: number;
  label: string;
  escalation?: number | null;
}

export function ScatterChart({
  data,
  xLabel,
  yLabel,
  yFmt,
}: {
  data: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  yFmt?: (v: number) => string;
}) {
  if (!data.length) return <Unavailable />;

  const W = 600;
  const H = 260;
  const PAD = { top: 18, right: 18, bottom: 48, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const xMin = 0; const xMax = Math.max(...xs, 100);
  const yMin = 0; const yMax = Math.max(...ys, 100);

  const sx = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const sy = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const TICKS = 5;
  const xTicks = Array.from({ length: TICKS + 1 }, (_, i) =>
    xMin + ((xMax - xMin) * i) / TICKS
  );
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) =>
    yMin + ((yMax - yMin) * i) / TICKS
  );

  return (
    <div className="ch-svg-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="ch-svg" aria-label="Scatter plot">
        {/* Grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={sy(v)} x2={W - PAD.right} y2={sy(v)} className="ch-grid" />
            <text x={PAD.left - 4} y={sy(v) + 4} className="ch-axis-text" textAnchor="end">
              {(yFmt ?? fmtPct)(v)}
            </text>
          </g>
        ))}
        {xTicks.map((v, i) => (
          <text key={i} x={sx(v)} y={H - PAD.bottom + 13} className="ch-axis-text" textAnchor="middle">
            {fmtPct(v)}
          </text>
        ))}

        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} className="ch-axis" />
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} className="ch-axis" />

        {/* Axis labels */}
        <text x={W / 2} y={H - 4} className="ch-axis-text" textAnchor="middle" fontSize={9}>
          {xLabel}
        </text>

        {/* Points */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={sx(d.x)}
            cy={sy(d.y)}
            r={3.5}
            fill="var(--orange)"
            opacity={0.7}
            stroke="var(--white)"
            strokeWidth={0.8}
          >
            <title>{`${d.label}\n${xLabel}: ${fmtPct(d.x)}\n${yLabel}: ${fmtPct(d.y)}${d.escalation != null ? `\nEscalation: ${fmtPct(d.escalation)}` : ""}`}</title>
          </circle>
        ))}
      </svg>
      <div className="ch-axis-label-x">{yLabel} →</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   BOX PLOT
────────────────────────────────────────────────────────────────────── */
interface BoxGroup {
  group: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

export function BoxPlotChart({ data }: { data: BoxGroup[] }) {
  if (!data.length) return <Unavailable />;

  const allVals = data.flatMap((d) => [d.min, d.max]);
  const absMax = Math.max(...allVals, 1);
  const absMin = Math.min(...allVals, 0);
  const range = absMax - absMin || 1;

  const toX = (v: number) => ((v - absMin) / range) * 100;

  return (
    <div className="ch-boxplot-list">
      {data.map((d) => (
        <div key={d.group} className="ch-boxplot-row">
          <div className="ch-boxplot-label" title={d.group}>{d.group}</div>
          <div className="ch-boxplot-track-wrap">
            <div
              className="ch-boxplot-box"
              style={{
                left: `${toX(d.q1)}%`,
                width: `${Math.max(1, toX(d.q3) - toX(d.q1))}%`,
              }}
            />
            <div className="ch-boxplot-whisker" style={{ left: `${toX(d.min)}%`, width: `${Math.max(1, toX(d.max) - toX(d.min))}%` }} />
            <div className="ch-boxplot-median" style={{ left: `${toX(d.median)}%` }} />
          </div>
          <div className="ch-boxplot-val">{fmtPct(d.median)}</div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   HEATMAP TABLE
────────────────────────────────────────────────────────────────────── */
interface HeatCell {
  group: string;
  period: string;
  value: number | null;
  count: number;
}

export function HeatmapTable({ cells, groups, periods }: { cells: HeatCell[]; groups: string[]; periods: string[] }) {
  if (!cells.length) return <Unavailable />;

  const byKey: Record<string, HeatCell> = {};
  for (const c of cells) byKey[`${c.group}|${c.period}`] = c;

  const validValues = cells.filter((c) => c.value != null).map((c) => c.value as number);
  const maxVal = Math.max(...validValues, 1);

  const intensity = (v: number) => Math.max(0.06, Math.min(1, v / maxVal));

  const visGroups = groups.slice(0, 14);
  const visPeriods = periods.slice(-12);

  return (
    <div className="ch-heatmap-wrap">
      <table className="ch-heatmap">
        <thead>
          <tr>
            <th>Group</th>
            {visPeriods.map((p) => (
              <th key={p}>{p.slice(0, 7)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visGroups.map((g) => (
            <tr key={g}>
              <th title={g}>{g.length > 24 ? g.slice(0, 22) + "…" : g}</th>
              {visPeriods.map((p) => {
                const c = byKey[`${g}|${p}`];
                const val = c?.value ?? null;
                return (
                  <td
                    key={p}
                    style={
                      val != null
                        ? { background: `rgba(242,106,33,${intensity(val)})`, color: val > maxVal * 0.6 ? "var(--white)" : "var(--ink)" }
                        : undefined
                    }
                    title={c ? `${c.count} obs — ${fmtPct(val)}` : "No data"}
                  >
                    {val != null ? fmtPct(val) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
