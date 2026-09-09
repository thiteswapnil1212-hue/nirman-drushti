import Link from "next/link";

export default function HomePage() {
  return <div className="nd-page">
    <section className="nd-hero"><div className="nd-container nd-hero-grid"><div>
      <p className="nd-eyebrow">Central monitoring / infrastructure register</p>
      <h1 className="nd-title">Monitor projects.<br />Prioritize attention.</h1>
      <p className="nd-lead">Review cost, progress and schedule performance across major infrastructure projects.</p>
      <div className="nd-button-group"><Link href="/projects" className="nd-button nd-button-primary">Open project register</Link><Link href="/data" className="nd-button nd-button-secondary">View data sources</Link></div>
    </div><aside className="nd-status-panel"><p className="nd-eyebrow">Data status</p><strong>PAIMANA register</strong><p>Imported project observations with reporting history retained.</p></aside></div></section>
    <section className="nd-section"><div className="nd-container"><div className="nd-section-heading"><div><p className="nd-eyebrow">How to read the platform</p><h2 className="nd-heading">A register first.<br />Analysis follows.</h2></div><p className="nd-section-intro">Nirman Drushti keeps the source record visible, separates observed values from future model outputs, and gives each project a traceable history.</p></div><div className="nd-flow">{[["01","DATA","Imported project records and reporting periods."],["02","MONITORING","Cost, progress and schedule observations."],["03","ANALYSIS","Historical comparisons when data exists."],["04","WARNING","Observed signals, never fabricated predictions."],["05","ACTION","Officer-led review and intervention."]].map(([number,title,description]) => <article className="nd-flow-item" key={number}><b>{number}</b><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>
  </div>;
}
