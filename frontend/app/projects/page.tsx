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
import { useEffect, useState } from "react";

import { listProjects, type ApiProject } from "@/lib/api";

const pageSizes = [20, 50, 100];

const number = (value: string | number | null) =>
  value === null || value === "" ? null : Number(value);

const value = (value: string | number | null, suffix = "") => {
  const parsed = number(value);

  return parsed === null || !Number.isFinite(parsed)
    ? "Not available"
    : `${parsed.toLocaleString("en-IN")}${suffix}`;
};

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
      <tr key={index} className="nd-skeleton-row">
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

  const renderProjectRow = (project: ApiProject) => {
    const progress = getProgress(project.physical_progress);

    return (
      <tr key={project.id} className="nd-project-row">
        <td className="nd-project-cell">
          <Link
            href={`/projects/${project.id}`}
            className="nd-project-link"
          >
            <span className="nd-project-title">
              {project.name || "Not available"}
            </span>

            <span className="nd-project-code">
              {project.project_code || "Project code unavailable"}
            </span>
          </Link>
        </td>

        <td>
          <div className="nd-agency-cell">
            <Building2 size={15} />
            <span>{project.implementing_agency || "Not available"}</span>
          </div>
        </td>

        <td>
          <div className="nd-state-cell">
            <MapPin size={14} />
            <span>{project.state || "Not available"}</span>
          </div>
        </td>

        <td className="nd-money-cell">
          {money(project.original_cost)}
        </td>

        <td className="nd-money-cell">
          {money(project.current_cost)}
        </td>

        <td className="nd-progress-cell">
          {progress === null ? (
            <span className="nd-muted">Not available</span>
          ) : (
            <div className="nd-progress-wrapper">
              <div className="nd-progress-header">
                <span>{progress}%</span>
              </div>

              <div className="nd-progress-track">
                <div
                  className="nd-progress-bar"
                  style={{ width: `${progress}%` }}
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
      {/* HEADER */}
      <section className="nd-section nd-project-header">
        <div className="nd-container">
          <div className="nd-header-top">
            <div>
              <div className="nd-breadcrumb">
                <span>Monitoring</span>
                <ChevronRight size={14} />
                <span>Projects</span>
              </div>

              <div className="nd-header-title-row">
                <div className="nd-title-icon">
                  <Database size={22} />
                </div>

                <div>
                  <h1 className="nd-page-title">
                    Project Register
                  </h1>

                  <p className="nd-page-description">
                    Browse and monitor recorded infrastructure projects.
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
            </div>
          </div>
        </div>
      </section>

      {/* FILTER BAR */}
      <section className="nd-section nd-section-tight">
        <div className="nd-container">
          <div className="nd-filter-card">
            <div className="nd-filter-header">
              <div className="nd-filter-title">
                <SlidersHorizontal size={16} />
                <span>Project filters</span>
              </div>

              {hasFilters && (
                <button
                  type="button"
                  className="nd-clear-button"
                  onClick={clearFilters}
                >
                  <X size={14} />
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
                  <Search size={17} />

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
                      <X size={15} />
                    </button>
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
                        Searching project register...
                      </div>
                    ) : error ? (
                      <div className="nd-search-status nd-search-error">
                        {error}
                      </div>
                    ) : data?.items.length ? (
                      <>
                        <div className="nd-search-results-heading">
                          Matching projects
                        </div>

                        {data.items.slice(0, 6).map((project) => (
                          <Link
                            href={`/projects/${project.id}`}
                            className="nd-search-result"
                            key={project.id}
                          >
                            <div className="nd-search-result-icon">
                              <Database size={15} />
                            </div>

                            <div className="nd-search-result-content">
                              <strong>
                                {project.name || "Not available"}
                              </strong>

                              <span>
                                {project.project_code ||
                                  "Project code unavailable"}
                              </span>

                              <small>
                                {project.implementing_agency ||
                                  "Agency unavailable"}
                                {" · "}
                                {project.state || "State unavailable"}
                              </small>
                            </div>

                            <ExternalLink size={15} />
                          </Link>
                        ))}
                      </>
                    ) : (
                      <div className="nd-search-empty">
                        <strong>No matching projects</strong>
                        <span>
                          Try a different project name, code, agency or
                          state.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STATE */}
              <div className="nd-filter-field">
                <label className="nd-field-label">State</label>

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
      <section className="nd-section nd-project-table-section">
        <div className="nd-container">
          {error && !hasSearch ? (
            <div className="nd-error-card">
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

                <tbody>{renderSkeletonRows()}</tbody>
              </table>
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="nd-empty-card">
              <div className="nd-empty-icon">
                <Search size={22} />
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
                <div>
                  <strong>Projects</strong>

                  <span>
                    {loading
                      ? "Updating results..."
                      : `${data?.items.length ?? 0} records displayed`}
                  </span>
                </div>

                {loading && data && (
                  <span className="nd-updating">
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
                  <span className="nd-pagination-label">
                    Showing
                  </span>

                  <strong>
                    {data?.total
                      ? `${(page - 1) * pageSize + 1}–${Math.min(
                          page * pageSize,
                          data.total,
                        )}`
                      : "0"}
                  </strong>

                  <span className="nd-pagination-label">
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
                    <ChevronLeft size={17} />
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
                    disabled={page >= totalPages || loading}
                    onClick={() =>
                      setPage((current) => current + 1)
                    }
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <style jsx>{`
        .nd-page {
          min-height: 100vh;
          background: #f7f8fa;
          color: #171717;
        }

        .nd-section {
          width: 100%;
        }

        .nd-section-tight {
          padding-top: 0;
          padding-bottom: 0;
        }

        .nd-container {
          width: min(1440px, calc(100% - 48px));
          margin: 0 auto;
        }

        /* HEADER */

        .nd-project-header {
          background: #ffffff;
          border-bottom: 1px solid #e7e7e7;
          padding: 28px 0 26px;
        }

        .nd-header-top {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 30px;
        }

        .nd-breadcrumb {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 18px;
          color: #737373;
          font-size: 12px;
          font-weight: 500;
        }

        .nd-header-title-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .nd-title-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #171717;
          color: #ffffff;
          border-radius: 10px;
        }

        .nd-page-title {
          margin: 0;
          font-size: 28px;
          line-height: 1.15;
          font-weight: 650;
          letter-spacing: -0.025em;
        }

        .nd-page-description {
          margin: 5px 0 0;
          color: #707070;
          font-size: 13px;
        }

        .nd-register-count {
          min-width: 150px;
          padding-left: 24px;
          border-left: 1px solid #e5e5e5;
        }

        .nd-register-count span {
          display: block;
          margin-bottom: 4px;
          color: #737373;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .nd-register-count strong {
          display: block;
          font-size: 25px;
          font-weight: 650;
          letter-spacing: -0.02em;
        }

        /* FILTERS */

        .nd-filter-card {
          position: relative;
          margin-top: 20px;
          padding: 18px;
          background: #ffffff;
          border: 1px solid #e3e5e8;
          border-radius: 12px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          z-index: 20;
        }

        .nd-filter-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .nd-filter-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 650;
          color: #404040;
        }

        .nd-clear-button {
          display: flex;
          align-items: center;
          gap: 5px;
          border: 0;
          background: transparent;
          color: #666666;
          font-size: 12px;
          cursor: pointer;
          padding: 4px 6px;
        }

        .nd-clear-button:hover {
          color: #111111;
        }

        .nd-filter-grid {
          display: grid;
          grid-template-columns: minmax(300px, 2fr) 1fr 1fr 130px;
          gap: 12px;
        }

        .nd-field-label {
          display: block;
          margin-bottom: 7px;
          color: #565656;
          font-size: 11px;
          font-weight: 600;
        }

        .nd-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .nd-input-wrapper > svg {
          position: absolute;
          left: 12px;
          color: #8a8a8a;
          pointer-events: none;
        }

        .nd-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border: 1px solid #dcdfe3;
          border-radius: 7px;
          outline: none;
          background: #ffffff;
          color: #171717;
          font-size: 13px;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .nd-search-input {
          padding-left: 38px;
          padding-right: 36px;
        }

        .nd-input::placeholder {
          color: #a1a1a1;
        }

        .nd-input:focus,
        .nd-select:focus {
          border-color: #111111;
          box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.06);
        }

        .nd-input-clear {
          position: absolute;
          right: 9px;
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 5px;
          background: transparent;
          color: #777777;
          cursor: pointer;
        }

        .nd-input-clear:hover {
          background: #f1f1f1;
          color: #222222;
        }

        .nd-select {
          width: 100%;
          height: 40px;
          padding: 0 10px;
          border: 1px solid #dcdfe3;
          border-radius: 7px;
          outline: none;
          background: #ffffff;
          color: #222222;
          font-size: 13px;
          cursor: pointer;
        }

        /* SEARCH DROPDOWN */

        .nd-search-results {
          position: absolute;
          left: 18px;
          top: 88px;
          width: calc(
            (100% - 54px) * 0.5
          );
          min-width: 400px;
          max-height: 390px;
          overflow-y: auto;
          background: #ffffff;
          border: 1px solid #dedede;
          border-radius: 10px;
          box-shadow:
            0 12px 35px rgba(0, 0, 0, 0.12),
            0 2px 8px rgba(0, 0, 0, 0.05);
          z-index: 100;
        }

        .nd-search-results-heading {
          padding: 11px 14px 8px;
          color: #858585;
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-bottom: 1px solid #eeeeee;
        }

        .nd-search-result {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 11px 13px;
          color: inherit;
          text-decoration: none;
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.12s ease;
        }

        .nd-search-result:hover {
          background: #f7f7f7;
        }

        .nd-search-result:last-child {
          border-bottom: 0;
        }

        .nd-search-result-icon {
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f2f2f2;
          color: #555555;
          border-radius: 7px;
        }

        .nd-search-result-content {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .nd-search-result-content strong {
          overflow: hidden;
          color: #222222;
          font-size: 12px;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nd-search-result-content span {
          margin-top: 2px;
          color: #777777;
          font-size: 10px;
        }

        .nd-search-result-content small {
          margin-top: 3px;
          color: #9a9a9a;
          font-size: 10px;
        }

        .nd-search-result > svg {
          color: #a0a0a0;
          flex: 0 0 auto;
        }

        .nd-search-status,
        .nd-search-empty {
          padding: 22px;
          color: #707070;
          font-size: 12px;
        }

        .nd-search-empty {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nd-search-empty strong {
          color: #333333;
          font-size: 13px;
        }

        .nd-search-error {
          color: #b42318;
        }

        /* TABLE */

        .nd-project-table-section {
          padding-top: 20px;
          padding-bottom: 35px;
        }

        .nd-table-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 9px;
        }

        .nd-table-meta > div {
          display: flex;
          align-items: baseline;
          gap: 9px;
        }

        .nd-table-meta strong {
          font-size: 13px;
          font-weight: 650;
        }

        .nd-table-meta span {
          color: #888888;
          font-size: 11px;
        }

        .nd-updating {
          padding: 4px 8px;
          border: 1px solid #e4e4e4;
          border-radius: 999px;
          background: #ffffff;
          color: #777777 !important;
          font-size: 10px !important;
        }

        .nd-table-wrap {
          overflow: auto;
          background: #ffffff;
          border: 1px solid #e2e4e7;
          border-radius: 11px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.025);
        }

        .nd-table {
          width: 100%;
          min-width: 1100px;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 12px;
        }

        .nd-table thead th {
          position: sticky;
          top: 0;
          z-index: 5;
          padding: 11px 14px;
          background: #fafafa;
          border-bottom: 1px solid #e2e4e7;
          color: #666666;
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 0.04em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .nd-table tbody td {
          padding: 13px 14px;
          border-bottom: 1px solid #eeeeee;
          vertical-align: middle;
        }

        .nd-project-row {
          transition: background 0.12s ease;
        }

        .nd-project-row:hover {
          background: #fafafa;
        }

        .nd-project-row:last-child td {
          border-bottom: 0;
        }

        .nd-project-cell {
          width: 28%;
          min-width: 280px;
        }

        .nd-project-link {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: inherit;
          text-decoration: none;
        }

        .nd-project-title {
          max-width: 390px;
          overflow: hidden;
          color: #171717;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nd-project-link:hover .nd-project-title {
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .nd-project-code {
          color: #8a8a8a;
          font-size: 10px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco,
            Consolas, monospace;
        }

        .nd-agency-cell,
        .nd-state-cell {
          display: flex;
          align-items: center;
          gap: 6px;
          max-width: 220px;
          color: #555555;
        }

        .nd-agency-cell svg,
        .nd-state-cell svg {
          flex: 0 0 auto;
          color: #999999;
        }

        .nd-agency-cell span,
        .nd-state-cell span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nd-money-cell {
          color: #333333;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .nd-progress-cell {
          min-width: 130px;
        }

        .nd-progress-wrapper {
          width: 105px;
        }

        .nd-progress-header {
          margin-bottom: 5px;
          color: #454545;
          font-size: 11px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        .nd-progress-track {
          width: 100%;
          height: 4px;
          overflow: hidden;
          background: #e9e9e9;
          border-radius: 999px;
        }

        .nd-progress-bar {
          height: 100%;
          background: #171717;
          border-radius: inherit;
          transition: width 0.25s ease;
        }

        .nd-muted {
          color: #999999;
          font-size: 11px;
        }

        .nd-status-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border: 1px solid #dedede;
          border-radius: 999px;
          background: #f8f8f8;
          color: #444444;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
        }

        .nd-status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #222222;
        }

        .nd-status-label.neutral {
          color: #777777;
          background: #fafafa;
        }

        .nd-status-label.neutral .nd-status-dot {
          background: #a5a5a5;
        }

        /* PAGINATION */

        .nd-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 12px;
          padding: 8px 2px;
        }

        .nd-pagination-info {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #444444;
          font-size: 11px;
        }

        .nd-pagination-label {
          color: #888888;
        }

        .nd-pagination-info strong {
          font-weight: 650;
          color: #444444;
        }

        .nd-pagination-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nd-icon-button {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #dddddd;
          border-radius: 7px;
          background: #ffffff;
          color: #333333;
          cursor: pointer;
          transition:
            background 0.12s ease,
            border-color 0.12s ease;
        }

        .nd-icon-button:hover:not(:disabled) {
          border-color: #bdbdbd;
          background: #f5f5f5;
        }

        .nd-icon-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .nd-page-indicator {
          min-width: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          color: #8a8a8a;
          font-size: 11px;
        }

        .nd-page-indicator strong {
          color: #222222;
          font-weight: 650;
        }

        /* EMPTY / ERROR */

        .nd-empty-card,
        .nd-error-card {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          background: #ffffff;
          border: 1px solid #e2e4e7;
          border-radius: 11px;
          text-align: center;
        }

        .nd-empty-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 13px;
          background: #f2f2f2;
          color: #777777;
          border-radius: 10px;
        }

        .nd-empty-card strong,
        .nd-error-card strong {
          color: #292929;
          font-size: 14px;
          font-weight: 650;
        }

        .nd-empty-card > span,
        .nd-error-card > span {
          max-width: 380px;
          margin-top: 5px;
          color: #888888;
          font-size: 12px;
        }

        .nd-error-card {
          border-color: #ead5d2;
          background: #fffafa;
        }

        .nd-error-card strong {
          color: #9d2b20;
        }

        .nd-secondary-button {
          margin-top: 16px;
          height: 34px;
          padding: 0 13px;
          border: 1px solid #d7d7d7;
          border-radius: 7px;
          background: #ffffff;
          color: #333333;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .nd-secondary-button:hover {
          background: #f5f5f5;
        }

        /* SKELETON */

        .nd-skeleton-row td {
          padding-top: 15px;
          padding-bottom: 15px;
        }

        .nd-skeleton {
          position: relative;
          overflow: hidden;
          background: #eeeeee;
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
            rgba(255, 255, 255, 0.65),
            transparent
          );
          animation: nd-shimmer 1.4s infinite;
        }

        .nd-skeleton-lg {
          width: 220px;
          height: 13px;
        }

        .nd-skeleton-md {
          width: 100px;
          height: 12px;
        }

        .nd-skeleton-sm {
          width: 110px;
          height: 9px;
          margin-top: 7px;
        }

        .nd-skeleton-progress {
          width: 105px;
          height: 18px;
        }

        .nd-skeleton-status {
          width: 78px;
          height: 23px;
          border-radius: 999px;
        }

        @keyframes nd-shimmer {
          100% {
            transform: translateX(100%);
          }
        }

        /* RESPONSIVE */

        @media (max-width: 1100px) {
          .nd-filter-grid {
            grid-template-columns: 1fr 1fr;
          }

          .nd-search-main {
            grid-column: span 2;
          }

          .nd-page-size {
            max-width: 180px;
          }

          .nd-search-results {
            width: calc(100% - 36px);
          }
        }

        @media (max-width: 700px) {
          .nd-container {
            width: min(100% - 24px, 1440px);
          }

          .nd-project-header {
            padding: 20px 0;
          }

          .nd-header-top {
            align-items: flex-start;
            flex-direction: column;
            gap: 18px;
          }

          .nd-page-title {
            font-size: 23px;
          }

          .nd-page-description {
            font-size: 12px;
          }

          .nd-register-count {
            width: 100%;
            padding: 10px 0 0;
            border-top: 1px solid #e5e5e5;
            border-left: 0;
          }

          .nd-filter-card {
            margin-top: 12px;
            padding: 13px;
          }

          .nd-filter-grid {
            grid-template-columns: 1fr;
          }

          .nd-search-main {
            grid-column: auto;
          }

          .nd-search-results {
            position: fixed;
            left: 12px;
            right: 12px;
            top: 130px;
            width: auto;
            min-width: 0;
            max-height: 60vh;
          }

          .nd-pagination {
            gap: 12px;
            flex-direction: column;
            align-items: stretch;
          }

          .nd-pagination-info {
            justify-content: center;
          }

          .nd-pagination-actions {
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}