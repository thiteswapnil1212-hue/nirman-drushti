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
    description: "Cost · progress · schedule",
  },
  {
    number: "03",
    title: "Intelligence",
    description: "Changes · drivers · predictive signals",
  },
  {
    number: "04",
    title: "Warning",
    description: "Projects requiring attention",
  },
  {
    number: "05",
    title: "Action",
    description: "Officer review · intervention",
  },
];

const intelligenceQuestions = [
  {
    number: "01",
    title: "What changed?",
    description:
      "Cost, progress and schedule changes across reporting periods.",
  },
  {
    number: "02",
    title: "Why does it matter?",
    description:
      "Risk signals and factors associated with observed project behaviour.",
  },
  {
    number: "03",
    title: "What may happen next?",
    description:
      "Future reported cost or schedule revision likelihood.",
  },
  {
    number: "04",
    title: "What should the officer review?",
    description:
      "Projects and signals requiring monitoring attention.",
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
          {/* LEFT — HERO CONTENT */}

          <div className="nd-home-hero-content">
            <p className="nd-home-eyebrow">
              Central infrastructure monitoring
            </p>

            <h1 className="nd-home-title">
              From project data
              <br />
              <span>to actionable intelligence.</span>
            </h1>

            <p className="nd-home-description">
              Nirman Drushti analyses project reporting data to surface cost,
              progress and schedule signals, identify risk, and support timely
              officer review.
            </p>

            <div className="nd-home-actions">
              <Link
                href="/projects"
                className="nd-home-button nd-home-button-primary"
              >
                Explore Projects
                <span aria-hidden="true">→</span>
              </Link>

              <Link
                href="/projects"
                className="nd-home-button nd-home-button-secondary"
              >
                View Risk Intelligence
              </Link>
            </div>

            <div className="nd-home-reference">
              <span>ND / 01</span>
              <span>PROJECT INTELLIGENCE</span>
            </div>
          </div>

          {/* RIGHT — PROJECT INTELLIGENCE DIAGRAM */}

          <div className="nd-home-diagram">
            <div className="nd-home-diagram-header">
              <div>
                <span>PROJECT INTELLIGENCE</span>
                <strong>From reporting to action</strong>
              </div>

              <div
                className="nd-home-register-status"
                aria-label="Project register status"
              >
                <i />
                REGISTER
              </div>
            </div>

            <div className="nd-home-tree">
              {/* CONNECTION LINES */}

              <svg
                className="nd-home-tree-svg"
                viewBox="0 0 640 540"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  className="nd-tree-connection"
                  d="M320 72 V128"
                />

                <path
                  className="nd-tree-connection"
                  d="M320 128 H160 V192"
                />

                <path
                  className="nd-tree-connection"
                  d="M320 128 H480 V192"
                />

                <path
                  className="nd-tree-connection"
                  d="M160 192 V245 H320"
                />

                <path
                  className="nd-tree-connection"
                  d="M480 192 V245 H320"
                />

                <path
                  className="nd-tree-connection"
                  d="M320 245 V315"
                />

                <path
                  className="nd-tree-connection"
                  d="M320 315 V375 H180 V445"
                />

                <path
                  className="nd-tree-connection"
                  d="M320 375 H460 V445"
                />

                <circle
                  className="nd-tree-flow-dot nd-tree-flow-dot-one"
                  r="3"
                />

                <circle
                  className="nd-tree-flow-dot nd-tree-flow-dot-two"
                  r="3"
                />
              </svg>

              {/* 01 — PROJECT */}

              <article className="nd-tree-card nd-tree-card-project">
                <span className="nd-tree-number">01</span>

                <div className="nd-tree-card-content">
                  <small>PROJECT</small>

                  <strong>Project record</strong>

                  <p>Project details and reporting history</p>
                </div>

                <span className="nd-tree-node nd-tree-node-green" />
              </article>

              {/* 02 / 03 — MONITORING */}

              <div className="nd-tree-observations">
                <article className="nd-tree-card nd-tree-card-small">
                  <span className="nd-tree-number">02</span>

                  <div className="nd-tree-card-content">
                    <small>COST</small>

                    <strong>Cost &amp; expenditure</strong>

                    <p>Reported cost and expenditure changes</p>
                  </div>

                  <span className="nd-tree-node" />
                </article>

                <article className="nd-tree-card nd-tree-card-small">
                  <span className="nd-tree-number">03</span>

                  <div className="nd-tree-card-content">
                    <small>PROGRESS</small>

                    <strong>Physical progress</strong>

                    <p>Reported progress behaviour</p>
                  </div>

                  <span className="nd-tree-node" />
                </article>
              </div>

              {/* 04 — SCHEDULE / ANALYSIS */}

              <article className="nd-tree-card nd-tree-card-analysis">
                <span className="nd-tree-number">04</span>

                <div className="nd-tree-card-content">
                  <small>SCHEDULE</small>

                  <strong>Completion changes</strong>

                  <p>Reported completion and schedule changes</p>
                </div>

                <span className="nd-tree-node nd-tree-node-green" />
              </article>

              {/* 05 — ANALYSE */}

              <article className="nd-tree-card nd-tree-card-risk">
                <span className="nd-tree-number">05</span>

                <div className="nd-tree-card-content">
                  <small>ANALYSE</small>

                  <strong>Project intelligence</strong>

                  <p>Changes, trends and associated drivers</p>
                </div>

                <span className="nd-tree-node nd-tree-node-warning" />
              </article>

              {/* 06 / 07 — RISK + ACTION */}

              <div className="nd-tree-actions">
                <article className="nd-tree-card nd-tree-card-action">
                  <span className="nd-tree-number">06</span>

                  <div className="nd-tree-card-content">
                    <small>RISK</small>

                    <strong>Risk intelligence</strong>

                    <p>Cost · time · implementation</p>
                  </div>

                  <span className="nd-tree-node nd-tree-node-warning" />
                </article>

                <article className="nd-tree-card nd-tree-card-action">
                  <span className="nd-tree-number">07</span>

                  <div className="nd-tree-card-content">
                    <small>ACTION</small>

                    <strong>Officer review</strong>

                    <p>Evidence-based intervention</p>
                  </div>

                  <span className="nd-tree-node nd-tree-node-warning" />
                </article>
              </div>
            </div>

            <div className="nd-home-diagram-footer">
              <span>
                DATA → MONITOR → ANALYSE → PREDICT → EXPLAIN → WARN → ACT
              </span>

              <span>ND / 01</span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          INTELLIGENCE QUESTIONS
      ===================================================== */}

      <section className="nd-home-intelligence-section">
        <div className="nd-container">
          <div className="nd-home-section-heading nd-home-section-heading-intelligence">
            <div>
              <p className="nd-home-eyebrow">Project intelligence</p>

              <h2>
                Questions that
                <br />
                support review.
              </h2>
            </div>

            <p>
              Nirman Drushti turns changes in project reporting into concise
              intelligence for monitoring and officer review.
            </p>
          </div>

          <div className="nd-home-questions">
            {intelligenceQuestions.map((question) => (
              <article
                key={question.number}
                className="nd-home-question"
              >
                <span className="nd-home-question-number">
                  {question.number}
                </span>

                <div>
                  <h3>{question.title}</h3>

                  <p>{question.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          MONITORING FRAMEWORK
      ===================================================== */}

      <section className="nd-home-flow-section">
        <div className="nd-container">
          <div className="nd-home-section-heading">
            <div>
              <p className="nd-home-eyebrow">Monitoring framework</p>

              <h2>
                From project record
                <br />
                to actionable intelligence.
              </h2>
            </div>

            <p>
              Nirman Drushti analyses changes across project reporting periods
              to identify cost, progress and schedule signals, estimate future
              reported revisions, and surface projects requiring officer
              review.
            </p>
          </div>

          <div className="nd-home-flow">
            {monitoringStages.map((stage) => (
              <article
                key={stage.number}
                className="nd-home-flow-item"
              >
                <span>{stage.number}</span>

                <div>
                  <strong>{stage.title}</strong>

                  <p>{stage.description}</p>
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
          <span>NIRMAN DRUSHTI</span>

          <strong>Infrastructure project monitoring</strong>
        </div>
      </section>
    </main>
  );
}