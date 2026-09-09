"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
  HeatmapTable,
} from "@/components/charts";

import { AnimatedNumber } from "@/components/AnimatedNumber";

/* ============================================================
   TYPES
   ============================================================ */

type GroupBy =
  | "state"
  | "ministry"
  | "sector"
  | "implementing_agency";

type Category =
  | "state"
  | "ministry"
  | "sector"
  | "implementing_agency"
  | "status";

const filterValue = (value: string) => value.trim() || undefined;

type BoxPlotDatum = {
  group: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
};

type ScatterDatum = {
  x: number;
  y: number;
  label: string;
  escalation: number | null;
};

/* ============================================================
   HELPERS
   ============================================================ */

function safeToNum(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    return null;
  }

  return toNum(value);
}

/**
 * Percentage values used by the custom charts.
 *
 * Supports both:
 *   0.25  -> 25%
 *   25    -> 25%
 */
function normalizePercent(value: unknown): number | null {
  const numeric = safeToNum(value);

  if (
    numeric === null ||
    !Number.isFinite(numeric)
  ) {
    return null;
  }

  if (numeric >= -1 && numeric <= 1) {
    return numeric * 100;
  }

  return numeric;
}

function displayGroupBy(
  value: GroupBy | Category,
) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

function severityClass(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes("critical")) {
    return "nd-analytics-severity nd-severity-critical";
  }

  if (normalized.includes("high")) {
    return "nd-analytics-severity nd-severity-high";
  }

  if (normalized.includes("moderate")) {
    return "nd-analytics-severity nd-severity-moderate";
  }

  return "nd-analytics-severity nd-severity-low";
}

/* ============================================================
   METRIC TILE
   ============================================================ */

function MetricTile({
  label,
  value,
  format,
  sub,
  derived = false,
  emphasis = false,
}: {
  label: string;
  value:
    | string
    | number
    | null
    | undefined;
  format: (value: number) => string;
  sub?: string;
  derived?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={[
        "nd-intelligence-item",
        derived
          ? "nd-derived"
          : "nd-reported",
        emphasis
          ? "nd-metric-emphasis"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="nd-label">
        {label}

        {derived && (
          <span className="nd-derived-marker">
            Derived
          </span>
        )}
      </p>

      <strong>
        <AnimatedNumber
          value={value}
          format={format}
          fallback="—"
        />
      </strong>

      {sub && <p>{sub}</p>}
    </div>
  );
}

/* ============================================================
   FILTER FIELD
   ============================================================ */

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="nd-analytics-filter-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/* ============================================================
   SIMPLE ANIMATED SCATTER
   ============================================================ */

function AnimatedScatterPlot({
  data,
}: {
  data: ScatterDatum[];
}) {
  const width = 1120;
  const height = 540;

  const left = 78;
  const right = 34;
  const top = 42;
  const bottom = 76;

  const plotWidth =
    width - left - right;

  const plotHeight =
    height - top - bottom;

  const validData = data.filter(
    (item) =>
      Number.isFinite(item.x) &&
      Number.isFinite(item.y),
  );

  if (validData.length === 0) {
    return (
      <Unavailable
        reason="No project observations contain both physical progress and expenditure percentage."
      />
    );
  }

  /*
   * Keep physical progress readable.
   * If there are legitimate observations above 100,
   * they remain represented as overflow markers.
   */
  const xOverflow = validData.filter(
    (item) => item.x > 100,
  );

  const xMax = 100;

  /*
   * The main expenditure chart intentionally
   * stays at 0–100%. Extremely large expenditure
   * values are represented separately at the top.
   */
  const yMax = 100;

  const regularPoints = validData.filter(
    (item) =>
      item.x >= 0 &&
      item.x <= 100 &&
      item.y >= 0 &&
      item.y <= 100,
  );

  const overflowPoints = validData.filter(
    (item) =>
      item.y > 100 ||
      item.x > 100 ||
      item.x < 0 ||
      item.y < 0,
  );

  const xScale = (value: number) => {
    const clamped = Math.min(
      Math.max(value, 0),
      xMax,
    );

    return (
      left +
      (clamped / xMax) * plotWidth
    );
  };

  const yScale = (value: number) => {
    const clamped = Math.min(
      Math.max(value, 0),
      yMax,
    );

    return (
      top +
      plotHeight -
      (clamped / yMax) *
        plotHeight
    );
  };

  const ticks = [0, 20, 40, 60, 80, 100];

  return (
    <div className="nd-simple-chart">
      <style jsx>{`
        .nd-simple-chart {
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .nd-simple-chart-inner {
          min-width: 760px;
        }

        .nd-simple-svg {
          display: block;
          width: 100%;
          height: auto;
        }

        .nd-scatter-grid {
          stroke: #ded8d0;
          stroke-width: 1;
          stroke-dasharray: 4 6;
        }

        .nd-scatter-axis {
          stroke: #292521;
          stroke-width: 1.2;
        }

        .nd-scatter-tick {
          fill: #756e67;
          font-size: 11px;
        }

        .nd-scatter-label {
          fill: #655e57;
          font-size: 11px;
        }

        .nd-scatter-reference {
          stroke: #9c958d;
          stroke-width: 1.2;
          stroke-dasharray: 6 6;
        }

        .nd-scatter-point {
          fill: #f26a21;
          opacity: 0;
          stroke: #ffffff;
          stroke-width: 1.2;

          transform-box: fill-box;
          transform-origin: center;

          animation:
            nd-point-enter
            0.5s
            cubic-bezier(
              0.22,
              1,
              0.36,
              1
            )
            forwards;
        }

        .nd-scatter-point:hover {
          fill: #c95315;
          stroke-width: 2;
        }

        .nd-scatter-overflow {
          fill: #ffffff;
          stroke: #f26a21;
          stroke-width: 2;
          opacity: 0;

          animation:
            nd-overflow-enter
            0.55s
            ease-out
            forwards;
        }

        .nd-scatter-overflow-guide {
          stroke: #f26a21;
          stroke-width: 1;
          stroke-dasharray: 3 4;
          opacity: 0.35;
        }

        .nd-scatter-note {
          fill: #817a72;
          font-size: 10px;
        }

        .nd-scatter-legend-line {
          stroke: #9c958d;
          stroke-width: 1.2;
          stroke-dasharray: 5 5;
        }

        .nd-scatter-legend-text {
          fill: #817a72;
          font-size: 10px;
        }

        @keyframes nd-point-enter {
          from {
            opacity: 0;
            transform: scale(0.3);
          }

          to {
            opacity: 0.8;
            transform: scale(1);
          }
        }

        @keyframes nd-overflow-enter {
          from {
            opacity: 0;
            transform: scale(0.35);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @media (
          prefers-reduced-motion: reduce
        ) {
          .nd-scatter-point,
          .nd-scatter-overflow {
            animation: none;
            opacity: 0.8;
          }
        }
      `}</style>

      <div className="nd-simple-chart-inner">
        <svg
          className="nd-simple-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Physical progress versus expenditure percentage"
        >
          {/* TOP INFORMATION */}

          {overflowPoints.length > 0 && (
            <text
              x={left}
              y={18}
              className="nd-scatter-note"
            >
              {overflowPoints.length} observation
              {overflowPoints.length !== 1
                ? "s"
                : ""}{" "}
              outside the 0–100% chart range
            </text>
          )}

          {/* GRID */}

          {ticks.map((tick) => {
            const y = yScale(tick);

            return (
              <g key={`y-${tick}`}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  className="nd-scatter-grid"
                />

                <text
                  x={left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="nd-scatter-tick"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {ticks.map((tick) => {
            const x = xScale(tick);

            return (
              <g key={`x-${tick}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={top}
                  y2={height - bottom}
                  className="nd-scatter-grid"
                />

                <text
                  x={x}
                  y={height - bottom + 24}
                  textAnchor="middle"
                  className="nd-scatter-tick"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* AXES */}

          <line
            x1={left}
            x2={left}
            y1={top}
            y2={height - bottom}
            className="nd-scatter-axis"
          />

          <line
            x1={left}
            x2={width - right}
            y1={height - bottom}
            y2={height - bottom}
            className="nd-scatter-axis"
          />

          {/* 1:1 REFERENCE */}

          <line
            x1={xScale(0)}
            y1={yScale(0)}
            x2={xScale(100)}
            y2={yScale(100)}
            className="nd-scatter-reference"
          />

          <line
            x1={width - 205}
            x2={width - 178}
            y1={24}
            y2={24}
            className="nd-scatter-legend-line"
          />

          <text
            x={width - 170}
            y={28}
            className="nd-scatter-legend-text"
          >
            spend = delivery
          </text>

          {/* REGULAR OBSERVATIONS */}

          {regularPoints.map(
            (point, index) => {
              const cx = xScale(point.x);
              const cy = yScale(point.y);

              return (
                <circle
                  key={`${point.label}-${index}`}
                  cx={cx}
                  cy={cy}
                  r={4.5}
                  className="nd-scatter-point"
                  style={{
                    animationDelay: `${Math.min(
                      index * 8,
                      700,
                    )}ms`,
                  }}
                >
                  <title>
                    {point.label}
                    {" — "}
                    Physical progress:{" "}
                    {point.x.toFixed(1)}%
                    {" — "}
                    Expenditure:{" "}
                    {point.y.toFixed(1)}%
                    {point.escalation != null
                      ? ` — Escalation: ${point.escalation.toFixed(
                          1,
                        )}%`
                      : ""}
                  </title>
                </circle>
              );
            },
          )}

          {/* OVERFLOW OBSERVATIONS */}

          {overflowPoints.map(
            (point, index) => {
              const rawX = xScale(point.x);

              const cx = Math.min(
                Math.max(
                  rawX,
                  left + 7,
                ),
                width - right - 7,
              );

              const cy =
                point.y > 100
                  ? top + 9
                  : yScale(point.y);

              return (
                <g
                  key={`overflow-${point.label}-${index}`}
                >
                  {point.y > 100 && (
                    <line
                      x1={cx}
                      x2={cx}
                      y1={cy + 7}
                      y2={height - bottom}
                      className="nd-scatter-overflow-guide"
                    />
                  )}

                  <circle
                    cx={cx}
                    cy={cy}
                    r={5.5}
                    className="nd-scatter-overflow"
                    style={{
                      animationDelay: `${Math.min(
                        index * 35,
                        500,
                      )}ms`,
                    }}
                  >
                    <title>
                      {point.label}
                      {" — "}
                      Physical progress:{" "}
                      {point.x.toFixed(1)}%
                      {" — "}
                      Expenditure:{" "}
                      {point.y.toFixed(1)}%
                      {point.escalation != null
                        ? ` — Escalation: ${point.escalation.toFixed(
                            1,
                          )}%`
                        : ""}
                    </title>
                  </circle>
                </g>
              );
            },
          )}

          {/* AXIS LABELS */}

          <text
            x={
              left +
              plotWidth / 2
            }
            y={height - 20}
            textAnchor="middle"
            className="nd-scatter-label"
          >
            Physical progress (%)
          </text>

          <text
            x={17}
            y={
              top +
              plotHeight / 2
            }
            textAnchor="middle"
            transform={`rotate(-90 17 ${
              top +
              plotHeight / 2
            })`}
            className="nd-scatter-label"
          >
            Expenditure (%)
          </text>
        </svg>
      </div>
    </div>
  );
}

/* ============================================================
   SIMPLE ANIMATED BOX PLOT
   ============================================================ */

function AnimatedBoxPlot({
  data,
}: {
  data: BoxPlotDatum[];
}) {
  const visibleData = data.filter(
    (item) =>
      Number.isFinite(item.min) &&
      Number.isFinite(item.q1) &&
      Number.isFinite(item.median) &&
      Number.isFinite(item.q3) &&
      Number.isFinite(item.max),
  );

  if (visibleData.length === 0) {
    return (
      <Unavailable
        reason="Insufficient grouped escalation data for distribution."
      />
    );
  }

  const width = 1160;
  const rowHeight = 58;

  const top = 40;
  const bottom = 52;

  const left = 240;
  const right = 92;

  const plotWidth =
    width - left - right;

  const height =
    top +
    visibleData.length *
      rowHeight +
    bottom;

  /*
   * Keep the main chart readable.
   * Values above 500% remain represented
   * through an explicit overflow marker.
   */
  const displayMax = 500;

  const xScale = (value: number) => {
    const clamped = Math.min(
      Math.max(value, 0),
      displayMax,
    );

    return (
      left +
      (clamped / displayMax) *
        plotWidth
    );
  };

  const ticks = [
    0,
    100,
    200,
    300,
    400,
    500,
  ];

  return (
    <div className="nd-simple-boxplot">
      <style jsx>{`
        .nd-simple-boxplot {
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .nd-boxplot-inner {
          min-width: 820px;
        }

        .nd-box-svg {
          display: block;
          width: 100%;
          height: auto;
        }

        .nd-box-grid {
          stroke: #e2ddd6;
          stroke-width: 1;
          stroke-dasharray: 4 6;
        }

        .nd-box-axis {
          stroke: #292521;
          stroke-width: 1.2;
        }

        .nd-box-tick {
          fill: #7b746d;
          font-size: 10px;
        }

        .nd-box-label {
          fill: #2e2925;
          font-size: 11px;
        }

        .nd-box-count {
          fill: #8b837c;
          font-size: 10px;
        }

        .nd-box-whisker {
          stroke: #89827b;
          stroke-width: 1.8;
          stroke-linecap: square;

          stroke-dasharray: 600;
          stroke-dashoffset: 600;

          animation:
            nd-whisker-in
            0.8s
            cubic-bezier(
              0.22,
              1,
              0.36,
              1
            )
            forwards;
        }

        .nd-box-cap {
          stroke: #89827b;
          stroke-width: 1.4;
          opacity: 0;

          animation:
            nd-cap-in
            0.45s
            ease-out
            forwards;
        }

        .nd-box-iqr {
          fill: rgba(
            242,
            106,
            33,
            0.07
          );
          stroke: #f26a21;
          stroke-width: 1.5;

          transform-box: fill-box;
          transform-origin: center;

          animation:
            nd-iqr-in
            0.7s
            cubic-bezier(
              0.22,
              1,
              0.36,
              1
            )
            forwards;
        }

        .nd-box-median {
          stroke: #f26a21;
          stroke-width: 2.5;
          opacity: 0;

          animation:
            nd-median-in
            0.45s
            ease-out
            forwards;
        }

        .nd-box-overflow {
          fill: #ffffff;
          stroke: #f26a21;
          stroke-width: 1.8;
          opacity: 0;

          animation:
            nd-overflow-box-in
            0.5s
            ease-out
            forwards;
        }

        .nd-box-value {
          fill: #665f58;
          font-size: 10px;
          opacity: 0;

          animation:
            nd-cap-in
            0.5s
            ease-out
            forwards;
        }

        .nd-box-overflow-value {
          fill: #f26a21;
          font-size: 9px;
          font-weight: 600;
        }

        @keyframes nd-whisker-in {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes nd-cap-in {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes nd-iqr-in {
          from {
            opacity: 0;
            transform: scaleX(0.15);
          }

          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        @keyframes nd-median-in {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes nd-overflow-box-in {
          from {
            opacity: 0;
            transform: scale(0.4);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @media (
          prefers-reduced-motion: reduce
        ) {
          .nd-box-whisker {
            animation: none;
            stroke-dashoffset: 0;
          }

          .nd-box-cap,
          .nd-box-iqr,
          .nd-box-median,
          .nd-box-overflow,
          .nd-box-value {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>

      <div className="nd-boxplot-inner">
        <svg
          className="nd-box-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Escalation spread by comparison group"
        >
          {/* GRID */}

          {ticks.map((tick) => {
            const x = xScale(tick);

            return (
              <g
                key={`box-tick-${tick}`}
              >
                <line
                  x1={x}
                  x2={x}
                  y1={top - 12}
                  y2={
                    height -
                    bottom +
                    2
                  }
                  className="nd-box-grid"
                />

                <text
                  x={x}
                  y={
                    height -
                    14
                  }
                  textAnchor="middle"
                  className="nd-box-tick"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* MAIN AXIS */}

          <line
            x1={left}
            x2={left}
            y1={top - 12}
            y2={
              height -
              bottom +
              2
            }
            className="nd-box-axis"
          />

          {/* ROWS */}

          {visibleData.map(
            (item, index) => {
              const y =
                top +
                index *
                  rowHeight +
                rowHeight / 2;

              const minX =
                xScale(item.min);

              const q1X =
                xScale(item.q1);

              const medianX =
                xScale(
                  item.median,
                );

              const q3X =
                xScale(item.q3);

              const maxX =
                xScale(item.max);

              const boxWidth =
                Math.max(
                  2,
                  q3X - q1X,
                );

              const hasOverflow =
                item.max >
                displayMax;

              const label =
                item.group ||
                "Unknown group";

              const shortLabel =
                label.length > 32
                  ? `${label.slice(
                      0,
                      32,
                    )}…`
                  : label;

              return (
                <g
                  key={`${label}-${index}`}
                >
                  {/* LABEL */}

                  <text
                    x={left - 16}
                    y={y + 4}
                    textAnchor="end"
                    className="nd-box-label"
                  >
                    {shortLabel}

                    <title>
                      {label}
                    </title>
                  </text>

                  {/* COUNT */}

                  <text
                    x={width - 12}
                    y={y + 4}
                    textAnchor="end"
                    className="nd-box-count"
                  >
                    n={item.count}
                  </text>

                  {/* WHISKER */}

                  <line
                    x1={minX}
                    x2={maxX}
                    y1={y}
                    y2={y}
                    className="nd-box-whisker"
                    style={{
                      animationDelay: `${Math.min(
                        index * 70,
                        600,
                      )}ms`,
                    }}
                  />

                  {/* MIN CAP */}

                  <line
                    x1={minX}
                    x2={minX}
                    y1={y - 9}
                    y2={y + 9}
                    className="nd-box-cap"
                    style={{
                      animationDelay: `${Math.min(
                        index * 70 + 150,
                        700,
                      )}ms`,
                    }}
                  />

                  {/* MAX CAP */}

                  {!hasOverflow && (
                    <line
                      x1={maxX}
                      x2={maxX}
                      y1={y - 9}
                      y2={y + 9}
                      className="nd-box-cap"
                      style={{
                        animationDelay: `${Math.min(
                          index * 70 + 150,
                          700,
                        )}ms`,
                      }}
                    />
                  )}

                  {/* IQR */}

                  <rect
                    x={q1X}
                    y={y - 7}
                    width={boxWidth}
                    height={14}
                    rx={1}
                    className="nd-box-iqr"
                    style={{
                      animationDelay: `${Math.min(
                        index * 70 + 80,
                        700,
                      )}ms`,
                    }}
                  >
                    <title>
                      {label}
                      {" — "}
                      Q1:{" "}
                      {item.q1.toFixed(
                        1,
                      )}
                      %
                      {" — "}
                      Median:{" "}
                      {item.median.toFixed(
                        1,
                      )}
                      %
                      {" — "}
                      Q3:{" "}
                      {item.q3.toFixed(
                        1,
                      )}
                      %
                      {" — "}
                      Min:{" "}
                      {item.min.toFixed(
                        1,
                      )}
                      %
                      {" — "}
                      Max:{" "}
                      {item.max.toFixed(
                        1,
                      )}
                      %
                    </title>
                  </rect>

                  {/* MEDIAN */}

                  <line
                    x1={medianX}
                    x2={medianX}
                    y1={y - 8}
                    y2={y + 8}
                    className="nd-box-median"
                    style={{
                      animationDelay: `${Math.min(
                        index * 70 + 220,
                        850,
                      )}ms`,
                    }}
                  />

                  {/* MEDIAN VALUE */}

                  <text
                    x={
                      Math.min(
                        medianX + 7,
                        width - right - 45,
                      )
                    }
                    y={y - 12}
                    className="nd-box-value"
                    style={{
                      animationDelay: `${Math.min(
                        index * 70 + 300,
                        950,
                      )}ms`,
                    }}
                  >
                    {item.median.toFixed(
                      1,
                    )}
                    %
                  </text>

                  {/* OVERFLOW MARKER */}

                  {hasOverflow && (
                    <>
                      <path
                        d={`M ${
                          width -
                          right -
                          7
                        } ${y - 7}
                           L ${
                             width -
                             right +
                             2
                           } ${y}
                           L ${
                             width -
                             right -
                             7
                           } ${y + 7}
                           Z`}
                        className="nd-box-overflow"
                        style={{
                          animationDelay: `${Math.min(
                            index * 70 +
                              250,
                            900,
                          )}ms`,
                        }}
                      >
                        <title>
                          {label}
                          {" — "}
                          Actual maximum:{" "}
                          {item.max.toFixed(
                            1,
                          )}
                          %
                        </title>
                      </path>

                      <text
                        x={
                          width -
                          right +
                          8
                        }
                        y={y + 3}
                        className="nd-box-overflow-value"
                      >
                        &gt;
                        {displayMax}%
                        <title>
                          Actual maximum:{" "}
                          {item.max.toFixed(
                            1,
                          )}
                          %
                        </title>
                      </text>
                    </>
                  )}
                </g>
              );
            },
          )}

          {/* AXIS LABEL */}

          <text
            x={
              left +
              plotWidth / 2
            }
            y={height - 1}
            textAnchor="middle"
            className="nd-box-tick"
          >
            Cost escalation (%)
          </text>
        </svg>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function AnalyticsPage() {
  /* ----------------------------------------------------------
     FILTERS
     ---------------------------------------------------------- */

  const [state, setState] =
    useState("");

  const [ministry, setMinistry] =
    useState("");

  const [sector, setSector] =
    useState("");

  const [agency, setAgency] =
    useState("");

  const [period, setPeriod] =
    useState("");

  const [groupBy, setGroupBy] =
    useState<GroupBy>(
      "implementing_agency",
    );

  const [category, setCategory] =
    useState<Category>(
      "implementing_agency",
    );

  /* ----------------------------------------------------------
     API STATE
     ---------------------------------------------------------- */

  const [data, setData] =
    useState<
      ApiPortfolioAnalytics | null
    >(null);

  const [
    riskSummary,
    setRiskSummary,
  ] = useState<
    ApiRiskSummaryResponse | null
  >(null);

  const [
    warningData,
    setWarningData,
  ] = useState<
    ApiWarningList | null
  >(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  /* ==========================================================
     DATA FETCH
     ========================================================== */

  useEffect(() => {
    const controller =
      new AbortController();

    const timer =
      window.setTimeout(() => {
        setLoading(true);
        setError(null);

        Promise.all([
          getPortfolioAnalytics(
            {
              reporting_period:
                period || undefined,

              state: filterValue(state),

              ministry: filterValue(ministry),

              sector: filterValue(sector),

              implementing_agency: filterValue(agency),

              group_by: groupBy,
              category,
            },
            {
              signal:
                controller.signal,
            },
          ),

          getRiskSummary(
            {
              state: filterValue(state),

              ministry: filterValue(ministry),

              sector: filterValue(sector),

              implementing_agency: filterValue(agency),
            },
            {
              signal:
                controller.signal,
            },
          ),

          listWarnings(
            {
              page: 1,
              page_size: 6,

              state: filterValue(state),

              ministry: filterValue(ministry),

              sector: filterValue(sector),

              implementing_agency: filterValue(agency),
            },
            {
              signal:
                controller.signal,
            },
          ),
        ])
          .then(
            ([
              portfolio,
              risk,
              warnings,
            ]) => {
              if (
                controller.signal
                  .aborted
              ) {
                return;
              }

              setData(portfolio);
              setRiskSummary(
                risk,
              );
              setWarningData(
                warnings,
              );
            },
          )
          .catch((reason) => {
            if (
              !controller.signal
                .aborted
            ) {
              setError(
                reason instanceof
                  Error
                  ? reason.message
                  : "Analytics could not be loaded.",
              );
            }
          })
          .finally(() => {
            if (
              !controller.signal
                .aborted
            ) {
              setLoading(false);
            }
          });
      }, 220);

    return () => {
      window.clearTimeout(
        timer,
      );

      controller.abort();
    };
  }, [
    agency,
    category,
    groupBy,
    ministry,
    period,
    sector,
    state,
  ]);

  /* ==========================================================
     COST PRESSURE
     ========================================================== */

  const barData =
    useMemo(() => {
      if (!data) return [];

      return data.cost.groups
        .map((group) => {
          const value =
            safeToNum(
              group.derived_escalation_amount,
            );

          if (value == null) {
            return null;
          }

          return {
            label: String(
              group.group,
            ),
            value,
          };
        })
        .filter(
          (
            item,
          ): item is {
            label: string;
            value: number;
          } => item !== null,
        )
        .sort(
          (a, b) =>
            b.value - a.value,
        )
        .slice(0, 12);
    }, [data]);

  const costComparisonData =
    useMemo(() => {
      if (!data) return [];

      return data.cost.groups
        .map((group) => {
          const original =
            safeToNum(
              group.reported_original_cost,
            );

          const current =
            safeToNum(
              group.reported_current_cost,
            );

          if (
            original == null ||
            current == null
          ) {
            return null;
          }

          return {
            label: String(
              group.group,
            ),
            first: original,
            second: current,
          };
        })
        .filter(
          (
            item,
          ): item is {
            label: string;
            first: number;
            second: number;
          } => item !== null,
        )
        .sort(
          (a, b) =>
            b.second -
            b.first -
            (a.second -
              a.first),
        )
        .slice(0, 8);
    }, [data]);

  /* ==========================================================
     TIME SERIES
     ========================================================== */

  const expenditureTrendData =
    useMemo(() => {
      if (!data) return [];

      return data.trends.points
        .map((point) => ({
          x: String(
            point.reporting_period,
          ),
          y: safeToNum(
            point.reported_expenditure,
          ),
        }))
        .filter(
          (
            point,
          ): point is {
            x: string;
            y: number;
          } => point.y != null,
        );
    }, [data]);

  const progressTrendData =
    useMemo(() => {
      if (!data) return [];

      return data.trends.points
        .map((point) => ({
          x: String(
            point.reporting_period,
          ),
          y: safeToNum(
            point.reported_physical_progress,
          ),
        }))
        .filter(
          (
            point,
          ): point is {
            x: string;
            y: number;
          } => point.y != null,
        );
    }, [data]);

  /* ==========================================================
     DISTRIBUTIONS
     ========================================================== */

  const escalationHistData =
    useMemo(() => {
      if (!data) return [];

      return data.distributions
        .escalation_histogram
        .map((bucket) => ({
          lower:
            safeToNum(
              bucket.lower,
            ) ?? 0,

          upper:
            safeToNum(
              bucket.upper,
            ) ?? 0,

          count:
            Number(
              bucket.count,
            ) || 0,
        }));
    }, [data]);

  const progressHistData =
    useMemo(() => {
      if (!data) return [];

      return data.distributions
        .progress_histogram
        .map((bucket) => ({
          lower:
            safeToNum(
              bucket.lower,
            ) ?? 0,

          upper:
            safeToNum(
              bucket.upper,
            ) ?? 0,

          count:
            Number(
              bucket.count,
            ) || 0,
        }));
    }, [data]);

  /* ==========================================================
     SCATTER DATA
     ========================================================== */

  const scatterData =
    useMemo(() => {
      if (!data) return [];

      return data.distributions.scatter
        .map((point) => {
          const physical =
            normalizePercent(
              point.physical_progress,
            );

          const expenditure =
            normalizePercent(
              point.expenditure_percentage,
            );

          if (
            physical == null ||
            expenditure == null
          ) {
            return null;
          }

          return {
            x: physical,
            y: expenditure,

            label: String(
              point.project_name ??
                "Project",
            ),

            escalation:
              normalizePercent(
                point.escalation_percentage,
              ),
          };
        })
        .filter(
          (
            point,
          ): point is ScatterDatum =>
            point !== null,
        );
    }, [data]);

  /* ==========================================================
     BOX PLOT DATA
     ========================================================== */

  const boxData =
    useMemo(() => {
      if (!data) return [];

      return data.distributions
        .box_plot
        .map((group) => {
          const minimum =
            normalizePercent(
              group.minimum,
            );

          const q1 =
            normalizePercent(
              group.lower_quartile,
            );

          const median =
            normalizePercent(
              group.median,
            );

          const q3 =
            normalizePercent(
              group.upper_quartile,
            );

          const maximum =
            normalizePercent(
              group.maximum,
            );

          if (
            minimum == null ||
            q1 == null ||
            median == null ||
            q3 == null ||
            maximum == null
          ) {
            return null;
          }

          return {
            group: String(
              group.group,
            ),

            min: minimum,
            q1,
            median,
            q3,
            max: maximum,

            count:
              Number(
                group.count,
              ) || 0,
          };
        })
        .filter(
          (
            item,
          ): item is BoxPlotDatum =>
            item !== null,
        )
        .sort(
          (a, b) =>
            b.median -
            a.median,
        )
        .slice(0, 10);
    }, [data]);

  /* ==========================================================
     HEATMAP
     ========================================================== */

  const heatmapGroups =
    useMemo(() => {
      if (!data) return [];

      return [
        ...new Set(
          data.trends.heatmap.map(
            (cell) =>
              String(
                cell.group,
              ),
          ),
        ),
      ];
    }, [data]);

  const heatmapPeriods =
    useMemo(() => {
      if (!data) return [];

      return [
        ...new Set(
          data.trends.heatmap.map(
            (cell) =>
              String(
                cell.reporting_period,
              ),
          ),
        ),
      ].sort();
    }, [data]);

  const heatCells =
    useMemo(() => {
      if (!data) return [];

      return data.trends.heatmap.map(
        (cell) => ({
          group: String(
            cell.group,
          ),

          period: String(
            cell.reporting_period,
          ),

          value:
            safeToNum(
              cell.average_progress,
            ),

          count:
            Number(
              cell.observation_count,
            ) || 0,
        }),
      );
    }, [data]);

  /* ==========================================================
     BENCHMARKING
     ========================================================== */

  const benchRows =
    useMemo(
      () =>
        data?.benchmarking
          .rows ?? [],
      [data],
    );

  const benchmarkChartData =
    useMemo(
      () =>
        benchRows
          .map((row) => ({
            label: String(
              row.group,
            ),

            value:
              safeToNum(
                row.average_escalation_percentage,
              ),
          }))
          .filter(
            (
              row,
            ): row is {
              label: string;
              value: number;
            } =>
              row.value != null,
          )
          .slice(0, 8),
      [benchRows],
    );

  /* ==========================================================
     RISK
     ========================================================== */

  const riskComposition =
    useMemo(() => {
      if (!riskSummary) {
        return [];
      }

      const values = [
        [
          "Low",
          Number(
            riskSummary.summary
              .low_projects,
          ) || 0,
        ],

        [
          "Moderate",
          Number(
            riskSummary.summary
              .moderate_projects,
          ) || 0,
        ],

        [
          "High",
          Number(
            riskSummary.summary
              .high_projects,
          ) || 0,
        ],

        [
          "Critical",
          Number(
            riskSummary.summary
              .critical_projects,
          ) || 0,
        ],
      ] as const;

      const total =
        values.reduce(
          (sum, [, count]) =>
            sum + count,
          0,
        );

      if (total <= 0) {
        return [];
      }

      return values
        .filter(
          ([, count]) =>
            count > 0,
        )
        .map(
          ([label, count]) => ({
            label,
            count,

            percentage:
              (count / total) *
              100,
          }),
        );
    }, [riskSummary]);

  const riskRankData =
    useMemo(
      () =>
        (
          riskSummary
            ?.summary
            .top_projects ?? []
        )
          .map((project) => {
            const score =
              safeToNum(
                project.score,
              );

            if (score == null) {
              return null;
            }

            return {
              label: String(
                project.project_name,
              ),
              value: score,
            };
          })
          .filter(
            (
              project,
            ): project is {
              label: string;
              value: number;
            } => project !== null,
          )
          .slice(0, 8),
      [riskSummary],
    );

  /* ==========================================================
     ATTENTION
     ========================================================== */

  const attentionItems =
    warningData?.items ?? [];

  /* ==========================================================
     SUMMARY
     ========================================================== */

  const sum =
    data?.summary;

  /* ==========================================================
     FILTER STATE
     ========================================================== */

  const activeFilters =
    [
      state,
      ministry,
      sector,
      agency,
      period,
    ].filter(Boolean).length;

  const clearFilters = () => {
    setState("");
    setMinistry("");
    setSector("");
    setAgency("");
    setPeriod("");
  };

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="nd-page nd-analytics-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <section className="nd-section nd-analytics-header">
        <div className="nd-container">

          <div className="nd-analytics-header-row">

            <div>
              <p className="nd-eyebrow">
                Portfolio intelligence /
                reported register
              </p>

              <h1 className="nd-title nd-title-small">
                Portfolio analytics
              </h1>

              <p className="nd-lead">
                Reported cost,
                expenditure, physical
                progress, risk and
                group-level comparisons
                for the current reporting
                scope.
              </p>
            </div>

            <div className="nd-analytics-scope">

              <p className="nd-eyebrow">
                Current scope
              </p>

              <strong>
                {loading ? (
                  "Loading…"
                ) : (
                  <AnimatedNumber
                    value={
                      sum?.project_count
                    }
                    format={(value) =>
                      Math.round(
                        value,
                      ).toLocaleString(
                        "en-IN",
                      )
                    }
                    fallback="—"
                  />
                )}
              </strong>

              <span>
                projects
              </span>

            </div>

          </div>

        </div>
      </section>

      {/* ======================================================
          FILTERS
          ====================================================== */}

      <section className="nd-section nd-section-tight">
        <div className="nd-container">

          <div className="nd-analytics-filter-shell">

            <div className="nd-analytics-filter-top">

              <div>
                <p className="nd-eyebrow">
                  Analysis controls
                </p>

                <h2>
                  Filter the portfolio
                </h2>
              </div>

              {activeFilters > 0 && (
                <button
                  type="button"
                  className="nd-clear-filter"
                  onClick={
                    clearFilters
                  }
                >
                  Clear filters

                  <span>
                    {activeFilters}
                  </span>
                </button>
              )}

            </div>

            <div className="nd-analytics-filters">

              <FilterField label="Reporting period">
                <input
                  className="nd-input"
                  type="month"
                  value={period.slice(
                    0,
                    7,
                  )}
                  onChange={(event) =>
                    setPeriod(
                      event.target
                        .value
                        ? `${event.target.value}-01`
                        : "",
                    )
                  }
                />
              </FilterField>

              <FilterField label="State">
                <input
                  className="nd-input"
                  value={state}
                  onChange={(event) =>
                    setState(
                      event.target.value,
                    )
                  }
                  placeholder="State"
                />
              </FilterField>

              <FilterField label="Ministry">
                <input
                  className="nd-input"
                  value={ministry}
                  disabled
                  placeholder="Unavailable in current data"
                  title="Ministry is null across the current imported project dataset."
                />
              </FilterField>

              <FilterField label="Sector">
                <input
                  className="nd-input"
                  value={sector}
                  disabled
                  placeholder="Unavailable in current data"
                  title="Sector is null across the current imported project dataset."
                />
              </FilterField>

              <FilterField label="Agency">
                <input
                  className="nd-input"
                  value={agency}
                  onChange={(event) =>
                    setAgency(
                      event.target.value,
                    )
                  }
                  placeholder="Implementing agency"
                />
              </FilterField>

              <FilterField label="Compare by">
                <select
                  className="nd-select"
                  value={groupBy}
                  onChange={(event) =>
                    setGroupBy(
                      event.target
                        .value as GroupBy,
                    )
                  }
                >
                  <option value="implementing_agency">
                    Agency
                  </option>

                  <option value="state">
                    State
                  </option>

                  <option value="ministry" disabled>
                    Ministry (unavailable)
                  </option>

                  <option value="sector" disabled>
                    Sector (unavailable)
                  </option>
                </select>
              </FilterField>

              <FilterField label="Composition">
                <select
                  className="nd-select"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target
                        .value as Category,
                    )
                  }
                >
                  <option value="implementing_agency">
                    Agency
                  </option>

                  <option value="state">
                    State
                  </option>

                  <option value="ministry" disabled>
                    Ministry (unavailable)
                  </option>

                  <option value="sector" disabled>
                    Sector (unavailable)
                  </option>

                  <option value="status">
                    Status
                  </option>
                </select>
              </FilterField>

            </div>

          </div>

        </div>
      </section>

      {/* ======================================================
          ERROR
          ====================================================== */}

      {error && (
        <section className="nd-section nd-section-tight">
          <div className="nd-container">

            <div className="nd-error">
              {error}
            </div>

          </div>
        </section>
      )}

      {/* ======================================================
          LOADING
          ====================================================== */}

      {!error &&
        loading && (
          <section className="nd-section">
            <div className="nd-container">

              <div className="nd-analytics-loading">

                <div className="nd-analytics-loading-line" />

                <div className="nd-analytics-loading-grid">

                  {Array.from(
                    { length: 6 },
                  ).map(
                    (_, index) => (
                      <div
                        key={index}
                        className="nd-analytics-loading-card"
                      />
                    ),
                  )}

                </div>

                <div className="nd-analytics-loading-chart" />

              </div>

            </div>
          </section>
        )}

      {/* ======================================================
          CONTENT
          ====================================================== */}

      {!error &&
        !loading &&
        data && (
          <>

            {/* ==================================================
                01 — PORTFOLIO POSITION
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="01"
                  title="Portfolio position"
                />

                <p className="nd-analytics-kicker">
                  Scale, capital committed,
                  cash spent and reported
                  delivery across the
                  current filter scope.
                </p>

                <div className="nd-intelligence-grid nd-analytics-kpis">

                  <MetricTile
                    label="Total projects"
                    value={
                      sum?.project_count
                    }
                    format={fmtInt}
                    sub="Current scope"
                    emphasis
                  />

                  <MetricTile
                    label="Original cost"
                    value={safeToNum(
                      sum
                        ?.reported_original_cost
                        .value,
                    )}
                    format={fmtCrore}
                    sub="Reported value"
                  />

                  <MetricTile
                    label="Current cost"
                    value={safeToNum(
                      sum
                        ?.reported_current_cost
                        .value,
                    )}
                    format={fmtCrore}
                    sub="Reported value"
                  />

                  <MetricTile
                    label="Expenditure"
                    value={safeToNum(
                      sum
                        ?.reported_expenditure
                        .value,
                    )}
                    format={fmtCrore}
                    sub="Reported value"
                  />

                  <MetricTile
                    label="Cost escalation"
                    value={safeToNum(
                      sum
                        ?.derived_cost_escalation_percentage
                        .value,
                    )}
                    format={fmtPct}
                    sub="Derived comparison"
                    derived
                  />

                  <MetricTile
                    label="Physical progress"
                    value={safeToNum(
                      sum
                        ?.reported_average_progress
                        .value,
                    )}
                    format={fmtPct}
                    sub="Reported value"
                  />

                </div>

              </div>
            </section>

            {/* ==================================================
                02 — COST PRESSURE
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="02"
                  title="Cost pressure"
                />

                <p className="nd-analytics-kicker">
                  Groups with the largest
                  derived escalation amounts.
                  Only groups with valid
                  reported original and
                  current cost data are
                  shown.
                </p>

                <div className="nd-analytics-two-col nd-analytics-primary-grid">

                  <div>

                    <div className="nd-chart-section-label">
                      Escalation amount
                    </div>

                    <ChartCard>
                      {barData.length >
                      0 ? (
                        <HBarChart
                          data={
                            barData
                          }
                          fmt={
                            fmtCrore
                          }
                        />
                      ) : (
                        <Unavailable
                          reason="No groups have both original and current cost reported."
                        />
                      )}
                    </ChartCard>

                  </div>

                  <div>

                    <div className="nd-chart-section-label">
                      Original versus current
                    </div>

                    <ChartCard>
                      {costComparisonData.length >
                      0 ? (
                        <ComparisonBars
                          data={
                            costComparisonData
                          }
                          firstLabel="Original"
                          secondLabel="Current"
                          fmt={
                            fmtCrore
                          }
                        />
                      ) : (
                        <Unavailable
                          reason="No comparable original and current cost data is available."
                        />
                      )}
                    </ChartCard>

                  </div>

                </div>

              </div>
            </section>

            {/* ==================================================
                03 — DELIVERY & EXPENDITURE
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="03"
                  title="Delivery and expenditure"
                />

                <div className="nd-analytics-two-col">

                  <div>

                    <div className="nd-chart-section-heading">

                      <div>
                        <span className="nd-eyebrow">
                          Time series
                        </span>

                        <h3>
                          Expenditure movement
                        </h3>
                      </div>

                      <span className="nd-chart-unit">
                        ₹ Crore
                      </span>

                    </div>

                    <ChartCard>
                      {expenditureTrendData.length >
                      0 ? (
                        <LineChart
                          data={
                            expenditureTrendData
                          }
                          yFmt={
                            fmtCrore
                          }
                          yLabel="₹ Crore"
                        />
                      ) : (
                        <Unavailable
                          reason="No reported expenditure observations are available."
                        />
                      )}
                    </ChartCard>

                  </div>

                  <div>

                    <div className="nd-chart-section-heading">

                      <div>
                        <span className="nd-eyebrow">
                          Time series
                        </span>

                        <h3>
                          Physical progress
                        </h3>
                      </div>

                      <span className="nd-chart-unit">
                        Percent
                      </span>

                    </div>

                    <ChartCard>
                      {progressTrendData.length >
                      0 ? (
                        <LineChart
                          data={
                            progressTrendData
                          }
                          yFmt={
                            fmtPct
                          }
                          yLabel="Progress %"
                        />
                      ) : (
                        <Unavailable
                          reason="No reported physical progress observations are available."
                        />
                      )}
                    </ChartCard>

                  </div>

                </div>

              </div>
            </section>

            {/* ==================================================
                04 — DISTRIBUTION
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="04"
                  title="Distribution of portfolio observations"
                />

                <p className="nd-analytics-kicker">
                  Frequency of observed
                  escalation and physical
                  progress values.
                </p>

                <div className="nd-analytics-two-col">

                  <div>

                    <div className="nd-chart-section-label">
                      Cost escalation
                    </div>

                    <ChartCard>
                      {escalationHistData.length >
                      0 ? (
                        <Histogram
                          data={
                            escalationHistData
                          }
                          xLabel="Escalation %"
                        />
                      ) : (
                        <Unavailable
                          reason="No cost escalation distribution is available."
                        />
                      )}
                    </ChartCard>

                  </div>

                  <div>

                    <div className="nd-chart-section-label">
                      Physical progress
                    </div>

                    <ChartCard>
                      {progressHistData.length >
                      0 ? (
                        <Histogram
                          data={
                            progressHistData
                          }
                          xLabel="Progress %"
                        />
                      ) : (
                        <Unavailable
                          reason="No physical progress distribution is available."
                        />
                      )}
                    </ChartCard>

                  </div>

                </div>

              </div>
            </section>

            {/* ==================================================
                05 — SPEND VS DELIVERY
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="05"
                  title="Spend versus delivery"
                />

                <p className="nd-analytics-kicker">
                  Project-level relationship
                  between reported physical
                  progress and reported
                  expenditure percentage.
                  Each point represents an
                  available project
                  observation.
                </p>

                <ChartCard>

                  {scatterData.length >
                  0 ? (
                    <AnimatedScatterPlot
                      data={
                        scatterData
                      }
                    />
                  ) : (
                    <Unavailable
                      reason="No project observations contain both physical progress and expenditure percentage."
                    />
                  )}

                </ChartCard>

              </div>
            </section>

            {/* ==================================================
                06 — ESCALATION SPREAD
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="06"
                  title={`Escalation spread by ${displayGroupBy(
                    groupBy,
                  )}`}
                />

                <p className="nd-analytics-kicker">
                  Distribution of escalation
                  observations across the
                  selected comparison groups.
                  The box shows the
                  interquartile range; the
                  whiskers show the observed
                  minimum and maximum.
                </p>

                <ChartCard>

                  {boxData.length >
                  0 ? (
                    <AnimatedBoxPlot
                      data={
                        boxData
                      }
                    />
                  ) : (
                    <Unavailable
                      reason="Insufficient grouped escalation data for distribution."
                    />
                  )}

                </ChartCard>

              </div>
            </section>

            {/* ==================================================
                07 — RISK
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="07"
                  title="Risk concentration"
                />

                <p className="nd-analytics-kicker">
                  Existing risk-summary
                  records for the current
                  portfolio scope.
                </p>

                <div className="nd-analytics-two-col">

                  <div>

                    <div className="nd-chart-section-label">
                      Risk composition
                    </div>

                    <ChartCard
                      style={{
                        minHeight: 300,
                      }}
                    >
                      {riskComposition.length >
                      0 ? (
                        <DonutChart
                          data={
                            riskComposition
                          }
                        />
                      ) : (
                        <Unavailable
                          reason="No populated risk composition is available for this scope."
                        />
                      )}
                    </ChartCard>

                  </div>

                  <div>

                    <div className="nd-chart-section-label">
                      Highest-risk projects
                    </div>

                    <ChartCard>

                      {riskRankData.length >
                      0 ? (
                        <HBarChart
                          data={
                            riskRankData
                          }
                          fmt={(value) =>
                            value.toFixed(
                              1,
                            )
                          }
                        />
                      ) : (
                        <Unavailable
                          reason="No populated ranked risk projects are available for this scope."
                        />
                      )}

                    </ChartCard>

                  </div>

                </div>

              </div>
            </section>

            {/* ==================================================
                08 — PROGRESS CONCENTRATION
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="08"
                  title="Progress concentration"
                />

                <p className="nd-analytics-kicker">
                  Average reported physical
                  progress across groups and
                  reporting periods.
                </p>

                {heatCells.length >
                0 ? (
                  <div className="nd-analytics-heatmap-shell">

                    <HeatmapTable
                      cells={
                        heatCells
                      }
                      groups={
                        heatmapGroups
                      }
                      periods={
                        heatmapPeriods
                      }
                    />

                  </div>
                ) : (
                  <Unavailable
                    reason="No group × period observation data is available."
                  />
                )}

              </div>
            </section>

            {/* ==================================================
                09 — BENCHMARKING
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="09"
                  title="Benchmarking"
                />

                <p className="nd-analytics-kicker">
                  Groups ranked using the
                  existing benchmarking
                  response. No new benchmark
                  calculation is introduced
                  here.
                </p>

                {benchmarkChartData.length >
                  0 && (
                    <div className="nd-benchmark-chart">

                      <div className="nd-chart-section-label">
                        Average escalation
                      </div>

                      <ChartCard>

                        <HBarChart
                          data={
                            benchmarkChartData
                          }
                          fmt={
                            fmtPct
                          }
                        />

                      </ChartCard>

                    </div>
                  )}

                {benchRows.length >
                0 ? (
                  <div className="nd-table-wrap nd-analytics-table">

                    <table className="nd-table">

                      <thead>
                        <tr>
                          <th>
                            Rank
                          </th>

                          <th>
                            {displayGroupBy(
                              groupBy,
                            )}
                          </th>

                          <th>
                            Projects
                          </th>

                          <th>
                            Avg. progress
                          </th>

                          <th>
                            Avg. expenditure
                          </th>

                          <th>
                            Avg. escalation
                          </th>
                        </tr>
                      </thead>

                      <tbody>

                        {benchRows
                          .slice(
                            0,
                            20,
                          )
                          .map(
                            (
                              row,
                            ) => (
                              <tr
                                key={String(
                                  row.group,
                                )}
                              >

                                <td>
                                  {
                                    row.rank
                                  }
                                </td>

                                <td className="nd-project-name">
                                  {
                                    row.group
                                  }
                                </td>

                                <td>
                                  {fmtInt(
                                    Number(
                                      row.project_count,
                                    ) || 0,
                                  )}
                                </td>

                                <td>
                                  {fmtPct(
                                    safeToNum(
                                      row.average_progress,
                                    ),
                                  )}
                                </td>

                                <td>
                                  {fmtPct(
                                    safeToNum(
                                      row.average_expenditure_percentage,
                                    ),
                                  )}
                                </td>

                                <td>
                                  {fmtPct(
                                    safeToNum(
                                      row.average_escalation_percentage,
                                    ),
                                  )}
                                </td>

                              </tr>
                            ),
                          )}

                      </tbody>

                    </table>

                  </div>
                ) : (
                  <Unavailable
                    reason="No group data for benchmarking in this filter scope."
                  />
                )}

              </div>
            </section>

            {/* ==================================================
                10 — SCHEDULE
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="10"
                  title="Schedule analytics"
                />

                <div className="nd-data-availability">

                  <div className="nd-data-availability-mark">
                    —
                  </div>

                  <div>

                    <p className="nd-eyebrow">
                      Data availability
                    </p>

                    <h3>
                      Date-level schedule
                      distribution is not
                      available
                    </h3>

                    <p>
                      The current portfolio
                      analytics API exposes
                      an aggregate
                      schedule-extension
                      count, but does not
                      expose valid
                      date-level distribution
                      or period-level
                      schedule history for
                      this view.
                    </p>

                  </div>

                </div>

              </div>
            </section>

            {/* ==================================================
                11 — ATTENTION
                ================================================== */}

            <section className="nd-section">
              <div className="nd-container">

                <SectionIndex
                  n="11"
                  title="Projects requiring attention"
                />

                <p className="nd-analytics-kicker">
                  Existing warning records
                  returned for the current
                  filter scope.
                </p>

                {attentionItems.length >
                0 ? (
                  <div className="nd-attention-grid">

                    {attentionItems.map(
                      (warning) => (
                        <article
                          className="nd-attention-item"
                          key={String(
                            warning.warning_id,
                          )}
                        >

                          <div className="nd-attention-meta">

                            <span
                              className={severityClass(
                                String(
                                  warning.severity,
                                ),
                              )}
                            >
                              {
                                warning.severity
                              }
                            </span>

                            <span className="nd-attention-type">
                              {String(
                                warning.type,
                              ).replaceAll(
                                "_",
                                " ",
                              )}
                            </span>

                          </div>

                          <h3
                            title={String(
                              warning.project_name,
                            )}
                          >
                            {
                              warning.project_name
                            }
                          </h3>

                          <p>
                            {
                              warning.message
                            }
                          </p>

                        </article>
                      ),
                    )}

                  </div>
                ) : (
                  <Unavailable
                    reason="No warning records are available for this reporting scope."
                  />
                )}

              </div>
            </section>

          </>
        )}

    </div>
  );
}
