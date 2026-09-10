"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  ExternalLink,
  Database,
  MapPin,
  Building2,
  X,
} from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

import { listProjects, type ApiProject } from "@/lib/api";

const pageSizes = [20, 50, 100];

const number = (value: string | number | null) =>
  value === null || value === "" ? null : Number(value);

const money = (value: string | number | null) => {
  const parsed = number(value);

  return parsed === null || !Number.isFinite(parsed)
    ? "Not available"
    : `₹${parsed.toLocaleString("en-IN")} Cr`;
};

const getProgress = (value: string | number | null) => {
  const parsed = number(value);

  if (parsed === null || !Number.isFinite(parsed)) return null;

  return Math.min(Math.max(parsed, 0), 100);
};

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [agency, setAgency] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [data, setData] = useState<{
    items: ApiProject[];
    total: number;
    page: number;
    page_size: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);

      listProjects(
        {
          page,
          page_size: pageSize,
          search,
          state,
          implementing_agency: agency,
        },
        { signal: controller.signal },
      )
        .then(setData)
        .catch((reason) => {
          if (!controller.signal.aborted) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Projects could not be loaded.",
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [agency, page, pageSize, search, state]);

  const totalPages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / pageSize),
  );

  const hasSearch = search.trim().length > 0;

  const hasFilters =
    search.trim().length > 0 ||
    state.trim().length > 0 ||
    agency.trim().length > 0;

  const clearFilters = () => {
    setSearch("");
    setState("");
    setAgency("");
    setPage(1);
  };

  const renderSkeletonRows = () =>
    Array.from({ length: 8 }).map((_, index) => (
      <tr
        key={index}
        className="nd-skeleton-row"
        style={
          {
            "--row-delay": `${index * 45}ms`,
          } as CSSProperties
        }
      >
        <td>
          <div className="nd-skeleton nd-skeleton-lg" />
          <div className="nd-skeleton nd-skeleton-sm" />
        </td>

        <td>
          <div className="nd-skeleton nd-skeleton-md" />
        </td>

        <td>
          <div className="nd-skeleton nd-skeleton-sm" />
        </td>

        <td>
          <div className="nd-skeleton nd-skeleton-md" />
        </td>

        <td>
          <div className="nd-skeleton nd-skeleton-md" />
        </td>

        <td>
          <div className="nd-skeleton nd-skeleton-progress" />
        </td>

        <td>
          <div className="nd-skeleton nd-skeleton-status" />
        </td>
      </tr>
    ));

  const renderProjectRow = (
    project: ApiProject,
    index: number,
  ) => {
    const progress = getProgress(project.physical_progress);

    return (
      <tr
        key={project.id}
        className="nd-project-row"
        style={
          {
            "--row-delay": `${Math.min(index, 12) * 35}ms`,
          } as CSSProperties
        }
      >
        <td className="nd-project-cell">
          <Link
            href={`/projects/${project.id}`}
            className="nd-project-link"
          >
            <div className="nd-project-main">
              <div className="nd-project-icon">
                <Database size={15} />
              </div>

              <div className="nd-project-copy">
                <span className="nd-project-title">
                  {project.name || "Not available"}
                </span>

                <span className="nd-project-code">
                  {project.project_code ||
                    "Project code unavailable"}
                </span>
              </div>
            </div>

            <div className="nd-row-arrow">
              <ExternalLink size={13} />
            </div>
          </Link>
        </td>

        <td>
          <div className="nd-agency-cell">
            <div className="nd-meta-icon">
              <Building2 size={13} />
            </div>

            <span>
              {project.implementing_agency || "Not available"}
            </span>
          </div>
        </td>

        <td>
          <div className="nd-state-cell">
            <MapPin size={13} />

            <span>
              {project.state || "Not available"}
            </span>
          </div>
        </td>

        <td className="nd-money-cell">
          {money(project.original_cost)}
        </td>

        <td className="nd-money-cell nd-current-cost">
          {money(project.current_cost)}
        </td>

        <td className="nd-progress-cell">
          {progress === null ? (
            <span className="nd-muted">Not available</span>
          ) : (
            <div className="nd-progress-wrapper">
              <div className="nd-progress-header">
                <span>Physical progress</span>

                <strong>{progress}%</strong>
              </div>

              <div className="nd-progress-track">
                <div
                  className="nd-progress-bar"
                  style={
                    {
                      width: `${progress}%`,
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          )}
        </td>

        <td>
          <span
            className={`nd-status-label ${
              project.status ? "" : "neutral"
            }`}
          >
            <span className="nd-status-dot" />

            {project.status || "Observed record"}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <main className="nd-page">
      <div className="nd-background-glow nd-glow-one" />
      <div className="nd-background-glow nd-glow-two" />

      {/* HEADER */}
      <section className="nd-project-header">
        <div className="nd-container">
          <div className="nd-header-top">
            <div className="nd-header-content">
              <div className="nd-breadcrumb">
                <span>MONITORING</span>
                <ChevronRight size={12} />
                <span>PROJECTS</span>
              </div>

              <div className="nd-header-title-row">
                <div className="nd-title-icon">
                  <Database size={21} />
                </div>

                <div>
                  <div className="nd-title-line">
                    <h1 className="nd-page-title">
                      Project Register
                    </h1>

                    <span className="nd-live-badge">
                      <span />
                      LIVE
                    </span>
                  </div>

                  <p className="nd-page-description">
                    Browse and monitor recorded infrastructure
                    projects.
                  </p>
                </div>
              </div>
            </div>

            <div className="nd-register-count">
              <span>Total projects</span>

              <strong>
                {data?.total !== undefined
                  ? data.total.toLocaleString("en-IN")
                  : "—"}
              </strong>

              <div className="nd-count-line" />
            </div>
          </div>
        </div>
      </section>

      {/* FILTER BAR */}
      <section className="nd-filter-section">
        <div className="nd-container">
          <div className="nd-filter-card">
            <div className="nd-filter-header">
              <div className="nd-filter-title">
                <div className="nd-filter-title-icon">
                  <SlidersHorizontal size={14} />
                </div>

                <div>
                  <span>Project filters</span>
                  <small>Refine the project register</small>
                </div>
              </div>

              {hasFilters && (
                <button
                  type="button"
                  className="nd-clear-button"
                  onClick={clearFilters}
                >
                  <X size={13} />
                  Clear filters
                </button>
              )}
            </div>

            <div className="nd-filter-grid">
              {/* SEARCH */}
              <div className="nd-search-field nd-search-main">
                <label className="nd-field-label">
                  Search projects
                </label>

                <div className="nd-input-wrapper">
                  <Search
                    size={16}
                    className="nd-search-icon"
                  />

                  <input
                    className="nd-input nd-search-input"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Name, project code, agency or state"
                  />

                  {search && (
                    <button
                      type="button"
                      className="nd-input-clear"
                      onClick={() => {
                        setSearch("");
                        setPage(1);
                      }}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}

                  {!search && (
                    <span className="nd-search-shortcut">
                      /
                    </span>
                  )}
                </div>

                {/* SEARCH RESULTS */}
                {hasSearch && (
                  <div
                    className="nd-search-results"
                    aria-live="polite"
                  >
                    {loading ? (
                      <div className="nd-search-status">
                        <div className="nd-loading-spinner" />
                        Searching project register...
                      </div>
                    ) : error ? (
                      <div className="nd-search-status nd-search-error">
                        {error}
                      </div>
                    ) : data?.items.length ? (
                      <>
                        <div className="nd-search-results-heading">
                          <span>Matching projects</span>
                          <span>
                            {Math.min(data.items.length, 6)}
                          </span>
                        </div>

                        {data.items
                          .slice(0, 6)
                          .map((project, index) => (
                            <Link
                              href={`/projects/${project.id}`}
                              className="nd-search-result"
                              key={project.id}
                              style={
                                {
                                  "--result-delay": `${index * 35}ms`,
                                } as CSSProperties
                              }
                            >
                              <div className="nd-search-result-icon">
                                <Database size={14} />
                              </div>

                              <div className="nd-search-result-content">
                                <strong>
                                  {project.name ||
                                    "Not available"}
                                </strong>

                                <span>
                                  {project.project_code ||
                                    "Project code unavailable"}
                                </span>

                                <small>
                                  {project.implementing_agency ||
                                    "Agency unavailable"}
                                  {" · "}
                                  {project.state ||
                                    "State unavailable"}
                                </small>
                              </div>

                              <ExternalLink
                                size={14}
                                className="nd-search-arrow"
                              />
                            </Link>
                          ))}
                      </>
                    ) : (
                      <div className="nd-search-empty">
                        <div className="nd-empty-search-icon">
                          <Search size={16} />
                        </div>

                        <div>
                          <strong>
                            No matching projects
                          </strong>

                          <span>
                            Try a different project name,
                            code, agency or state.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STATE */}
              <div className="nd-filter-field">
                <label className="nd-field-label">
                  State
                </label>

                <input
                  className="nd-input"
                  value={state}
                  onChange={(event) => {
                    setState(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by state"
                />
              </div>

              {/* AGENCY */}
              <div className="nd-filter-field">
                <label className="nd-field-label">
                  Implementing agency
                </label>

                <input
                  className="nd-input"
                  value={agency}
                  onChange={(event) => {
                    setAgency(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by agency"
                />
              </div>

              {/* PAGE SIZE */}
              <div className="nd-filter-field nd-page-size">
                <label className="nd-field-label">
                  Rows per page
                </label>

                <select
                  className="nd-select"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {pageSizes.map((size) => (
                    <option key={size} value={size}>
                      {size} rows
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TABLE */}
      <section className="nd-project-table-section">
        <div className="nd-container">
          {error && !hasSearch ? (
            <div className="nd-error-card">
              <div className="nd-error-icon">
                <X size={18} />
              </div>

              <strong>Unable to load projects</strong>

              <span>{error}</span>
            </div>
          ) : !data && loading ? (
            <div className="nd-table-wrap">
              <table className="nd-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Agency</th>
                    <th>State</th>
                    <th>Original cost</th>
                    <th>Current cost</th>
                    <th>Progress</th>
                    <th>Record</th>
                  </tr>
                </thead>

                <tbody>
                  {renderSkeletonRows()}
                </tbody>
              </table>
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="nd-empty-card">
              <div className="nd-empty-icon">
                <Search size={20} />
              </div>

              <strong>No projects found</strong>

              <span>
                No records match the current search or filters.
              </span>

              {hasFilters && (
                <button
                  type="button"
                  className="nd-secondary-button"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="nd-table-meta">
                <div className="nd-table-heading">
                  <div className="nd-table-heading-icon">
                    <Database size={14} />
                  </div>

                  <div>
                    <strong>Projects</strong>

                    <span>
                      {loading
                        ? "Updating results..."
                        : `${data?.items.length ?? 0} records displayed`}
                    </span>
                  </div>
                </div>

                {loading && data && (
                  <span className="nd-updating">
                    <span className="nd-updating-dot" />
                    Updating
                  </span>
                )}
              </div>

              <div className="nd-table-wrap">
                <table className="nd-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Agency</th>
                      <th>State</th>
                      <th>Original cost</th>
                      <th>Current cost</th>
                      <th>Progress</th>
                      <th>Record</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data?.items.map(renderProjectRow)}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="nd-pagination">
                <div className="nd-pagination-info">
                  <span>Showing</span>

                  <strong>
                    {data?.total
                      ? `${(page - 1) * pageSize + 1}–${Math.min(
                          page * pageSize,
                          data.total,
                        )}`
                      : "0"}
                  </strong>

                  <span>
                    of {data?.total?.toLocaleString("en-IN") ?? 0}
                  </span>
                </div>

                <div className="nd-pagination-actions">
                  <button
                    type="button"
                    className="nd-icon-button"
                    aria-label="Previous page"
                    disabled={page <= 1 || loading}
                    onClick={() =>
                      setPage((current) => current - 1)
                    }
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="nd-page-indicator">
                    <strong>{page}</strong>

                    <span>/</span>

                    <span>{totalPages}</span>
                  </div>

                  <button
                    type="button"
                    className="nd-icon-button"
                    aria-label="Next page"
                    disabled={
                      page >= totalPages || loading
                    }
                    onClick={() =>
                      setPage((current) => current + 1)
                    }
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <style jsx>{`
        .nd-page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(0, 0, 0, 0.025),
              transparent 28%
            ),
            #f6f7f9;
          color: #151515;
        }

        .nd-page::before {
          position: absolute;
          inset: 0;
          pointer-events: none;
          content: "";
          opacity: 0.35;
          background-image:
            linear-gradient(
              rgba(0, 0, 0, 0.018) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.018) 1px,
              transparent 1px
            );
          background-size: 42px 42px;
          mask-image: linear-gradient(
            to bottom,
            black,
            transparent 75%
          );
        }

        .nd-background-glow {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(90px);
          opacity: 0.16;
        }

        .nd-glow-one {
          top: -220px;
          right: 8%;
          background: #d4d4d4;
        }

        .nd-glow-two {
          top: 520px;
          left: -300px;
          background: #e1e1e1;
        }

        .nd-container {
          position: relative;
          z-index: 2;
          width: min(1480px, calc(100% - 64px));
          margin: 0 auto;
        }

        /* HEADER */

        .nd-project-header {
          position: relative;
          z-index: 5;
          padding: 34px 0 30px;
          background: rgba(255, 255, 255, 0.88);
          border-bottom: 1px solid #e5e7ea;
          backdrop-filter: blur(18px);
          animation: nd-fade-down 0.55s ease both;
        }

        .nd-header-top {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 40px;
        }

        .nd-header-content {
          animation: nd-slide-up 0.65s 0.05s ease both;
        }

        .nd-breadcrumb {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 19px;
          color: #969696;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
        }

        .nd-breadcrumb svg {
          color: #b5b5b5;
        }

        .nd-header-title-row {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .nd-title-icon {
          width: 46px;
          height: 46px;
          flex: 0 0 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #2b2b2b;
          border-radius: 12px;
          background: #171717;
          color: white;
          box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.12),
            inset 0 1px rgba(255, 255, 255, 0.12);
          animation: nd-icon-pop 0.6s 0.15s
            cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .nd-title-line {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nd-page-title {
          margin: 0;
          font-size: 29px;
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: -0.035em;
        }

        .nd-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 21px;
          padding: 0 7px;
          border: 1px solid #dfe2e5;
          border-radius: 999px;
          background: #fafafa;
          color: #747474;
          font-size: 8px;
          font-weight: 750;
          letter-spacing: 0.08em;
        }

        .nd-live-badge span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #1e1e1e;
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.06);
          animation: nd-pulse 2s infinite;
        }

        .nd-page-description {
          margin: 6px 0 0;
          color: #777b80;
          font-size: 12px;
          line-height: 1.5;
        }

        .nd-register-count {
          position: relative;
          min-width: 175px;
          padding: 4px 0 4px 25px;
          border-left: 1px solid #dedfe1;
          animation: nd-slide-left 0.65s 0.15s ease both;
        }

        .nd-register-count span {
          display: block;
          margin-bottom: 3px;
          color: #969696;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .nd-register-count strong {
          display: block;
          color: #191919;
          font-size: 27px;
          line-height: 1.1;
          font-weight: 700;
          letter-spacing: -0.035em;
          font-variant-numeric: tabular-nums;
        }

        .nd-count-line {
          width: 24px;
          height: 2px;
          margin-top: 8px;
          background: #202020;
          border-radius: 99px;
        }

        /* FILTER */

        .nd-filter-section {
          position: relative;
          z-index: 20;
          padding-top: 20px;
        }

        .nd-filter-card {
          position: relative;
          padding: 19px;
          border: 1px solid #e1e4e7;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.025),
            0 12px 35px rgba(0, 0, 0, 0.035);
          backdrop-filter: blur(15px);
          animation: nd-slide-up 0.65s 0.1s ease both;
        }

        .nd-filter-card::before {
          position: absolute;
          top: 0;
          left: 24px;
          width: 45px;
          height: 2px;
          content: "";
          background: #1a1a1a;
          border-radius: 0 0 4px 4px;
        }

        .nd-filter-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .nd-filter-title {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .nd-filter-title-icon {
          width: 29px;
          height: 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e1e1e1;
          border-radius: 7px;
          background: #f7f7f7;
          color: #444;
        }

        .nd-filter-title > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nd-filter-title span {
          color: #323232;
          font-size: 11px;
          font-weight: 700;
        }

        .nd-filter-title small {
          color: #a0a0a0;
          font-size: 9px;
        }

        .nd-clear-button {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 8px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #777;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          animation: nd-pop-in 0.25s ease both;
        }

        .nd-clear-button:hover {
          background: #f2f2f2;
          color: #111;
        }

        .nd-filter-grid {
          display: grid;
          grid-template-columns:
            minmax(340px, 2fr)
            minmax(150px, 0.85fr)
            minmax(190px, 1fr)
            130px;
          gap: 13px;
        }

        .nd-field-label {
          display: block;
          margin-bottom: 7px;
          color: #606060;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .nd-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .nd-search-icon {
          position: absolute;
          left: 13px;
          z-index: 1;
          color: #929292;
          pointer-events: none;
          transition: color 0.2s ease;
        }

        .nd-input-wrapper:focus-within .nd-search-icon {
          color: #222;
        }

        .nd-input {
          width: 100%;
          height: 41px;
          padding: 0 12px;
          border: 1px solid #dcdee1;
          border-radius: 8px;
          outline: none;
          background: #fff;
          color: #171717;
          font-size: 11px;
          box-shadow: inset 0 1px rgba(0, 0, 0, 0.015);
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.2s ease;
        }

        .nd-input:hover,
        .nd-select:hover {
          border-color: #c8cbd0;
        }

        .nd-input:focus,
        .nd-select:focus {
          border-color: #202020;
          box-shadow:
            0 0 0 3px rgba(20, 20, 20, 0.055),
            0 3px 8px rgba(0, 0, 0, 0.035);
        }

        .nd-input::placeholder {
          color: #aaa;
        }

        .nd-search-input {
          padding-left: 38px;
          padding-right: 35px;
        }

        .nd-input-clear {
          position: absolute;
          right: 8px;
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #888;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .nd-input-clear:hover {
          background: #eeeeee;
          color: #222;
          transform: rotate(90deg);
        }

        .nd-search-shortcut {
          position: absolute;
          right: 10px;
          width: 19px;
          height: 19px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e4e4e4;
          border-radius: 4px;
          background: #fafafa;
          color: #a0a0a0;
          font-family: ui-monospace, SFMono-Regular, Menlo,
            monospace;
          font-size: 10px;
        }

        .nd-select {
          width: 100%;
          height: 41px;
          padding: 0 10px;
          border: 1px solid #dcdee1;
          border-radius: 8px;
          outline: none;
          background: white;
          color: #222;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        /* SEARCH DROPDOWN */

        .nd-search-main {
          position: relative;
        }

        .nd-search-results {
          position: absolute;
          top: calc(100% + 9px);
          left: 0;
          width: 100%;
          max-height: 390px;
          overflow-y: auto;
          border: 1px solid #dedfe2;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow:
            0 24px 55px rgba(0, 0, 0, 0.13),
            0 5px 15px rgba(0, 0, 0, 0.06);
          backdrop-filter: blur(20px);
          z-index: 100;
          transform-origin: top center;
          animation: nd-dropdown-in 0.22s
            cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .nd-search-results-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 13px 9px;
          border-bottom: 1px solid #eeeeee;
          color: #878787;
          font-size: 8px;
          font-weight: 750;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .nd-search-results-heading span:last-child {
          min-width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 5px;
          background: #f1f1f1;
          color: #555;
          font-size: 8px;
        }

        .nd-search-result {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          color: inherit;
          text-decoration: none;
          border-bottom: 1px solid #f0f0f0;
          opacity: 0;
          animation: nd-result-in 0.3s var(--result-delay)
            ease forwards;
          transition:
            background 0.18s ease,
            padding-left 0.18s ease;
        }

        .nd-search-result:last-child {
          border-bottom: 0;
        }

        .nd-search-result:hover {
          padding-left: 16px;
          background: #f7f7f7;
        }

        .nd-search-result-icon {
          width: 31px;
          height: 31px;
          flex: 0 0 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e4e4e4;
          border-radius: 7px;
          background: #f5f5f5;
          color: #555;
        }

        .nd-search-result-content {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .nd-search-result-content strong {
          overflow: hidden;
          color: #222;
          font-size: 11px;
          font-weight: 650;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nd-search-result-content span {
          margin-top: 2px;
          color: #777;
          font-size: 9px;
        }

        .nd-search-result-content small {
          margin-top: 3px;
          overflow: hidden;
          color: #a0a0a0;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nd-search-arrow {
          flex: 0 0 auto;
          color: #aaa;
          transition:
            transform 0.2s ease,
            color 0.2s ease;
        }

        .nd-search-result:hover .nd-search-arrow {
          color: #333;
          transform: translate(2px, -2px);
        }

        .nd-search-status {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 20px;
          color: #777;
          font-size: 10px;
        }

        .nd-loading-spinner {
          width: 14px;
          height: 14px;
          border: 1.5px solid #ddd;
          border-top-color: #222;
          border-radius: 50%;
          animation: nd-spin 0.7s linear infinite;
        }

        .nd-search-error {
          color: #a42a20;
        }

        .nd-search-empty {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 19px;
        }

        .nd-empty-search-icon {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: #f2f2f2;
          color: #888;
        }

        .nd-search-empty > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .nd-search-empty strong {
          color: #333;
          font-size: 11px;
          font-weight: 650;
        }

        .nd-search-empty span {
          color: #999;
          font-size: 9px;
        }

        /* TABLE */

        .nd-project-table-section {
          position: relative;
          z-index: 2;
          padding: 24px 0 40px;
        }

        .nd-table-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          animation: nd-fade-in 0.5s ease both;
        }

        .nd-table-heading {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .nd-table-heading-icon {
          width: 29px;
          height: 29px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e3e5;
          border-radius: 7px;
          background: #fff;
          color: #555;
        }

        .nd-table-heading > div:last-child {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .nd-table-meta strong {
          color: #292929;
          font-size: 12px;
          font-weight: 700;
        }

        .nd-table-meta span {
          color: #999;
          font-size: 9px;
        }

        .nd-updating {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border: 1px solid #e1e1e1;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.8);
          color: #777 !important;
          font-size: 8px !important;
          font-weight: 600;
          animation: nd-fade-in 0.2s ease both;
        }

        .nd-updating-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #555;
          animation: nd-pulse 1s infinite;
        }

        .nd-table-wrap {
          position: relative;
          overflow: auto;
          border: 1px solid #dfe2e5;
          border-radius: 12px;
          background: #fff;
          box-shadow:
            0 2px 4px rgba(0, 0, 0, 0.025),
            0 14px 40px rgba(0, 0, 0, 0.035);
          animation: nd-table-in 0.65s 0.08s ease both;
        }

        .nd-table {
          width: 100%;
          min-width: 1160px;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 11px;
        }

        .nd-table thead th {
          position: sticky;
          top: 0;
          z-index: 5;
          padding: 12px 15px;
          border-bottom: 1px solid #e2e4e7;
          background: rgba(249, 250, 251, 0.97);
          color: #737373;
          font-size: 8px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
          backdrop-filter: blur(12px);
        }

        .nd-table tbody td {
          padding: 14px 15px;
          border-bottom: 1px solid #eeeeee;
          vertical-align: middle;
        }

        .nd-project-row {
          position: relative;
          opacity: 0;
          animation: nd-row-in 0.45s var(--row-delay)
            ease forwards;
          transition:
            background 0.2s ease,
            box-shadow 0.2s ease;
        }

        .nd-project-row:hover {
          background: #fafafa;
        }

        .nd-project-row:last-child td {
          border-bottom: 0;
        }

        .nd-project-cell {
          width: 28%;
          min-width: 290px;
        }

        .nd-project-link {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: inherit;
          text-decoration: none;
        }

        .nd-project-main {
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 10px;
        }

        .nd-project-icon {
          width: 31px;
          height: 31px;
          flex: 0 0 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e5e5e5;
          border-radius: 7px;
          background: #f7f7f7;
          color: #555;
          transition:
            background 0.2s ease,
            color 0.2s ease,
            transform 0.2s ease;
        }

        .nd-project-row:hover .nd-project-icon {
          background: #1d1d1d;
          border-color: #1d1d1d;
          color: white;
          transform: translateY(-1px);
        }

        .nd-project-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nd-project-title {
          display: block;
          max-width: 400px;
          overflow: hidden;
          color: #191919;
          font-size: 11px;
          font-weight: 650;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 0.18s ease;
        }

        .nd-project-row:hover .nd-project-title {
          color: #000;
        }

        .nd-project-code {
          color: #999;
          font-family: ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, monospace;
          font-size: 8px;
        }

        .nd-row-arrow {
          width: 25px;
          height: 25px;
          flex: 0 0 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e8e8e8;
          border-radius: 6px;
          background: white;
          color: #aaa;
          opacity: 0;
          transform: translateX(-4px);
          transition:
            opacity 0.2s ease,
            transform 0.2s ease,
            color 0.2s ease;
        }

        .nd-project-row:hover .nd-row-arrow {
          opacity: 1;
          transform: translateX(0);
          color: #333;
        }

        .nd-agency-cell,
        .nd-state-cell {
          display: flex;
          align-items: center;
          gap: 7px;
          max-width: 230px;
          color: #555;
        }

        .nd-meta-icon {
          width: 24px;
          height: 24px;
          flex: 0 0 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #f6f6f6;
          color: #888;
        }

        .nd-agency-cell span,
        .nd-state-cell span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nd-state-cell svg {
          flex: 0 0 auto;
          color: #999;
        }

        .nd-money-cell {
          color: #303030;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .nd-current-cost {
          font-weight: 600;
        }

        .nd-progress-cell {
          min-width: 155px;
        }

        .nd-progress-wrapper {
          width: 125px;
        }

        .nd-progress-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 6px;
          color: #999;
          font-size: 8px;
        }

        .nd-progress-header strong {
          color: #333;
          font-size: 9px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .nd-progress-track {
          width: 100%;
          height: 5px;
          overflow: hidden;
          border-radius: 999px;
          background: #e9eaec;
        }

        .nd-progress-bar {
          height: 100%;
          min-width: 2px;
          border-radius: inherit;
          background: #1b1b1b;
          transform-origin: left;
          animation: nd-progress-in 0.9s
            cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .nd-muted {
          color: #a1a1a1;
          font-size: 9px;
        }

        .nd-status-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border: 1px solid #dddddd;
          border-radius: 999px;
          background: #f8f8f8;
          color: #444;
          font-size: 8px;
          font-weight: 650;
          white-space: nowrap;
        }

        .nd-status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #222;
        }

        .nd-status-label.neutral {
          border-color: #e5e5e5;
          background: #fafafa;
          color: #888;
        }

        .nd-status-label.neutral .nd-status-dot {
          background: #aaa;
        }

        /* PAGINATION */

        .nd-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
          padding: 5px 1px;
        }

        .nd-pagination-info {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #999;
          font-size: 9px;
        }

        .nd-pagination-info strong {
          color: #444;
          font-size: 9px;
          font-weight: 700;
        }

        .nd-pagination-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .nd-icon-button {
          width: 31px;
          height: 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #dedfe1;
          border-radius: 7px;
          background: #fff;
          color: #444;
          cursor: pointer;
          transition:
            background 0.18s ease,
            border-color 0.18s ease,
            transform 0.18s ease,
            box-shadow 0.18s ease;
        }

        .nd-icon-button:hover:not(:disabled) {
          border-color: #c4c5c7;
          background: #f8f8f8;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
        }

        .nd-icon-button:active:not(:disabled) {
          transform: translateY(0) scale(0.96);
        }

        .nd-icon-button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .nd-page-indicator {
          min-width: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          color: #aaa;
          font-size: 9px;
        }

        .nd-page-indicator strong {
          color: #222;
          font-weight: 700;
        }

        /* EMPTY / ERROR */

        .nd-empty-card,
        .nd-error-card {
          min-height: 320px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          border: 1px solid #e0e2e5;
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.92);
          text-align: center;
          box-shadow: 0 10px 35px rgba(0, 0, 0, 0.035);
          animation: nd-slide-up 0.45s ease both;
        }

        .nd-empty-icon,
        .nd-error-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          border: 1px solid #e4e4e4;
          border-radius: 11px;
          background: #f5f5f5;
          color: #777;
        }

        .nd-error-icon {
          background: #fff4f3;
          border-color: #f0d6d2;
          color: #a62e24;
        }

        .nd-empty-card strong,
        .nd-error-card strong {
          color: #292929;
          font-size: 13px;
          font-weight: 700;
        }

        .nd-empty-card > span,
        .nd-error-card > span {
          max-width: 400px;
          margin-top: 5px;
          color: #929292;
          font-size: 10px;
          line-height: 1.5;
        }

        .nd-error-card {
          background: #fffafa;
          border-color: #ead8d5;
        }

        .nd-error-card strong {
          color: #9d2d23;
        }

        .nd-secondary-button {
          height: 34px;
          margin-top: 16px;
          padding: 0 13px;
          border: 1px solid #d8d8d8;
          border-radius: 7px;
          background: white;
          color: #333;
          font-size: 9px;
          font-weight: 650;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .nd-secondary-button:hover {
          border-color: #bbb;
          background: #f6f6f6;
          transform: translateY(-1px);
        }

        /* SKELETON */

        .nd-skeleton-row td {
          padding-top: 16px;
          padding-bottom: 16px;
        }

        .nd-skeleton {
          position: relative;
          overflow: hidden;
          background: #ededed;
          border-radius: 5px;
        }

        .nd-skeleton::after {
          position: absolute;
          inset: 0;
          content: "";
          transform: translateX(-100%);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.75),
            transparent
          );
          animation: nd-shimmer 1.35s infinite;
        }

        .nd-skeleton-lg {
          width: 235px;
          height: 12px;
        }

        .nd-skeleton-md {
          width: 105px;
          height: 11px;
        }

        .nd-skeleton-sm {
          width: 115px;
          height: 8px;
          margin-top: 7px;
        }

        .nd-skeleton-progress {
          width: 125px;
          height: 23px;
        }

        .nd-skeleton-status {
          width: 80px;
          height: 22px;
          border-radius: 999px;
        }

        /* ANIMATIONS */

        @keyframes nd-fade-down {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes nd-fade-in {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes nd-slide-up {
          from {
            opacity: 0;
            transform: translateY(14px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes nd-slide-left {
          from {
            opacity: 0;
            transform: translateX(14px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes nd-icon-pop {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(5px);
          }

          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes nd-table-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes nd-row-in {
          from {
            opacity: 0;
            transform: translateY(7px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes nd-progress-in {
          from {
            transform: scaleX(0);
          }

          to {
            transform: scaleX(1);
          }
        }

        @keyframes nd-dropdown-in {
          from {
            opacity: 0;
            transform: translateY(-5px) scaleY(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scaleY(1);
          }
        }

        @keyframes nd-result-in {
          from {
            opacity: 0;
            transform: translateX(-5px);
          }

          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes nd-pop-in {
          from {
            opacity: 0;
            transform: scale(0.94);
          }

          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes nd-shimmer {
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes nd-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes nd-pulse {
          0%,
          100% {
            opacity: 1;
          }

          50% {
            opacity: 0.35;
          }
        }

        /* RESPONSIVE */

        @media (max-width: 1200px) {
          .nd-container {
            width: min(100% - 40px, 1480px);
          }

          .nd-filter-grid {
            grid-template-columns: 1.5fr 1fr 1fr;
          }

          .nd-page-size {
            grid-column: span 1;
          }
        }

        @media (max-width: 900px) {
          .nd-header-top {
            align-items: flex-start;
            flex-direction: column;
          }

          .nd-register-count {
            width: 100%;
            padding: 13px 0 0;
            border-top: 1px solid #e2e2e2;
            border-left: 0;
          }

          .nd-filter-grid {
            grid-template-columns: 1fr 1fr;
          }

          .nd-search-main {
            grid-column: span 2;
          }
        }

        @media (max-width: 620px) {
          .nd-container {
            width: calc(100% - 24px);
          }

          .nd-project-header {
            padding: 23px 0;
          }

          .nd-header-title-row {
            align-items: flex-start;
          }

          .nd-title-icon {
            width: 40px;
            height: 40px;
            flex-basis: 40px;
          }

          .nd-page-title {
            font-size: 23px;
          }

          .nd-page-description {
            font-size: 10px;
          }

          .nd-live-badge {
            display: none;
          }

          .nd-filter-section {
            padding-top: 12px;
          }

          .nd-filter-card {
            padding: 14px;
            border-radius: 11px;
          }

          .nd-filter-grid {
            grid-template-columns: 1fr;
            gap: 11px;
          }

          .nd-search-main {
            grid-column: auto;
          }

          .nd-search-results {
            position: fixed;
            top: 105px;
            left: 12px;
            right: 12px;
            width: auto;
            max-height: 62vh;
          }

          .nd-filter-header {
            align-items: flex-start;
          }

          .nd-filter-title small {
            display: none;
          }

          .nd-project-table-section {
            padding-top: 18px;
          }

          .nd-table-meta > div:last-child {
            display: none;
          }

          .nd-table-heading > div:last-child {
            gap: 0;
          }

          .nd-table-heading > div:last-child span {
            display: none;
          }

          .nd-pagination {
            flex-direction: column;
            gap: 10px;
          }

          .nd-pagination-info {
            justify-content: center;
          }

          .nd-pagination-actions {
            justify-content: center;
          }

          .nd-empty-card,
          .nd-error-card {
            min-height: 260px;
            padding: 30px 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .nd-page *,
          .nd-page *::before,
          .nd-page *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}