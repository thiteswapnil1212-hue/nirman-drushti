import Link from "next/link";

const monitoringStages = [
  {
    number: "01",
    title: "Data",
    description: "Project records",
  },
  {
    number: "02",
    title: "Monitoring",
    description: "Cost, progress and schedule",
  },
  {
    number: "03",
    title: "Analysis",
    description: "Observed project changes",
  },
  {
    number: "04",
    title: "Warning",
    description: "Projects requiring attention",
  },
  {
    number: "05",
    title: "Action",
    description: "Review and intervention",
  },
];

export default function HomePage() {
  return (
    <main className="nd-home">

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="nd-home-hero">
        <div className="nd-container nd-home-hero-grid">

          {/* -------------------------------------------------
              LEFT — HERO CONTENT
          ------------------------------------------------- */}

          <div className="nd-home-hero-content">

            <p className="nd-home-eyebrow">
              Central infrastructure monitoring
            </p>

            <h1 className="nd-home-title">
              Monitor projects.
              <br />
              <span>Prioritize attention.</span>
            </h1>

            <p className="nd-home-description">
              Cost, progress and schedule monitoring for major
              infrastructure projects.
            </p>

            <div className="nd-home-actions">
              <Link
                href="/projects"
                className="nd-home-button nd-home-button-primary"
              >
                Open project register
                <span aria-hidden="true">→</span>
              </Link>

              <Link
                href="/data"
                className="nd-home-button nd-home-button-secondary"
              >
                Data sources
              </Link>
            </div>

            <div className="nd-home-reference">
              <span>ND / 01</span>
              <span>PROJECT MONITORING</span>
            </div>
          </div>


          {/* -------------------------------------------------
              RIGHT — PROJECT INTELLIGENCE DIAGRAM
          ------------------------------------------------- */}

          <div className="nd-home-diagram">

            <div className="nd-home-diagram-header">
              <div>
                <span>PROJECT INTELLIGENCE</span>
                <strong>Monitoring flow</strong>
              </div>

              <div className="nd-home-register-status">
                <i />
                REGISTER
              </div>
            </div>


            <div className="nd-home-tree">

              {/* ===========================================
                  CONNECTION LINES
              =========================================== */}

              <svg
                className="nd-home-tree-svg"
                viewBox="0 0 640 540"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {/* Project → observation */}

                <path
                  className="nd-tree-connection"
                  d="M320 72 V128"
                />

                {/* Observation branches */}

                <path
                  className="nd-tree-connection"
                  d="M320 128 H160 V192"
                />

                <path
                  className="nd-tree-connection"
                  d="M320 128 H480 V192"
                />

                {/* Observation → analysis */}

                <path
                  className="nd-tree-connection"
                  d="M160 192 V245 H320"
                />

                <path
                  className="nd-tree-connection"
                  d="M480 192 V245 H320"
                />

                {/* Analysis → risk */}

                <path
                  className="nd-tree-connection"
                  d="M320 245 V315"
                />

                {/* Risk → action */}

                <path
                  className="nd-tree-connection"
                  d="M320 315 V375 H180 V445"
                />

                <path
                  className="nd-tree-connection"
                  d="M320 375 H460 V445"
                />

                {/* Moving signal */}

                <circle
                  className="nd-tree-flow-dot nd-tree-flow-dot-one"
                  r="3"
                />

                <circle
                  className="nd-tree-flow-dot nd-tree-flow-dot-two"
                  r="3"
                />
              </svg>


              {/* ===========================================
                  PROJECT
              =========================================== */}

              <article className="nd-tree-card nd-tree-card-project">

                <span className="nd-tree-number">
                  01
                </span>

                <div className="nd-tree-card-content">
                  <small>INPUT</small>

                  <strong>
                    Project record
                  </strong>

                  <p>
                    Project details and reporting history
                  </p>
                </div>

                <span className="nd-tree-node nd-tree-node-green" />
              </article>


              {/* ===========================================
                  OBSERVATIONS
              =========================================== */}

              <div className="nd-tree-observations">

                <article className="nd-tree-card nd-tree-card-small">

                  <span className="nd-tree-number">
                    02
                  </span>

                  <div className="nd-tree-card-content">
                    <small>OBSERVATION</small>

                    <strong>
                      Cost
                    </strong>

                    <p>
                      Cost and expenditure
                    </p>
                  </div>

                  <span className="nd-tree-node" />
                </article>


                <article className="nd-tree-card nd-tree-card-small">

                  <span className="nd-tree-number">
                    03
                  </span>

                  <div className="nd-tree-card-content">
                    <small>OBSERVATION</small>

                    <strong>
                      Progress
                    </strong>

                    <p>
                      Delivery and milestones
                    </p>
                  </div>

                  <span className="nd-tree-node" />
                </article>

              </div>


              {/* ===========================================
                  ANALYSIS
              =========================================== */}

              <article className="nd-tree-card nd-tree-card-analysis">

                <span className="nd-tree-number">
                  04
                </span>

                <div className="nd-tree-card-content">
                  <small>ANALYSIS</small>

                  <strong>
                    Project analysis
                  </strong>

                  <p>
                    Changes across reporting periods
                  </p>
                </div>

                <span className="nd-tree-node nd-tree-node-green" />
              </article>


              {/* ===========================================
                  RISK
              =========================================== */}

              <article className="nd-tree-card nd-tree-card-risk">

                <span className="nd-tree-number">
                  05
                </span>

                <div className="nd-tree-card-content">
                  <small>ATTENTION</small>

                  <strong>
                    Risk
                  </strong>

                  <p>
                    Cost · time · implementation
                  </p>
                </div>

                <span className="nd-tree-node nd-tree-node-warning" />
              </article>


              {/* ===========================================
                  ACTIONS
              =========================================== */}

              <div className="nd-tree-actions">

                <article className="nd-tree-card nd-tree-card-action">

                  <span className="nd-tree-number">
                    06
                  </span>

                  <div className="nd-tree-card-content">
                    <small>REVIEW</small>

                    <strong>
                      Verify
                    </strong>

                    <p>
                      Officer review
                    </p>
                  </div>

                  <span className="nd-tree-node" />
                </article>


                <article className="nd-tree-card nd-tree-card-action">

                  <span className="nd-tree-number">
                    07
                  </span>

                  <div className="nd-tree-card-content">
                    <small>RESPONSE</small>

                    <strong>
                      Act
                    </strong>

                    <p>
                      Intervention
                    </p>
                  </div>

                  <span className="nd-tree-node nd-tree-node-warning" />
                </article>

              </div>

            </div>


            <div className="nd-home-diagram-footer">
              <span>
                DATA → MONITORING → ANALYSIS → WARNING → ACTION
              </span>

              <span>
                ND / 01
              </span>
            </div>

          </div>

        </div>
      </section>


      {/* =====================================================
          PLATFORM FLOW
      ===================================================== */}

      <section className="nd-home-flow-section">

        <div className="nd-container">

          <div className="nd-home-section-heading">

            <div>
              <p className="nd-home-eyebrow">
                Monitoring framework
              </p>

              <h2>
                From project record
                <br />
                to action.
              </h2>
            </div>

            <p>
              The platform keeps project observations visible while
              analysis and attention signals are derived from available
              reporting data.
            </p>

          </div>


          <div className="nd-home-flow">

            {monitoringStages.map((stage) => (
              <article
                key={stage.number}
                className="nd-home-flow-item"
              >
                <span>
                  {stage.number}
                </span>

                <div>
                  <strong>
                    {stage.title}
                  </strong>

                  <p>
                    {stage.description}
                  </p>
                </div>
              </article>
            ))}

          </div>

        </div>

      </section>


      {/* =====================================================
          FOOTER STATEMENT
      ===================================================== */}

      <section className="nd-home-footer-strip">

        <div className="nd-container">

          <span>
            NIRMAN DRUSHTI
          </span>

          <strong>
            Infrastructure project monitoring
          </strong>

        </div>

      </section>

    </main>
  );
}