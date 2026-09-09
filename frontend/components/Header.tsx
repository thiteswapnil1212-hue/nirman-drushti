"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  ["/", "Home"], ["/platform", "Platform"], ["/projects", "Projects"],
  ["/cost-intelligence", "Cost Intelligence"], ["/progress-intelligence", "Progress"],
  ["/risk-intelligence", "Risk Intelligence"], ["/early-warnings", "Early Warnings"],
  ["/analytics", "Analytics"], ["/model-evaluation", "Model Evaluation"], ["/what-if", "What-If"], ["/data", "Data"],
] as const;

export default function Header() {
  const pathname = usePathname();
  return <header className="nd-header"><div className="nd-header-inner">
    <Link href="/" className="nd-brand"><span className="nd-brand-mark">N</span><span className="nd-brand-copy">Nirman Drushti<small>Infrastructure monitoring</small></span></Link>
    <nav className="nd-navigation" aria-label="Primary navigation">{navigation.map(([href, label]) => { const active = href === "/" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className="nd-navigation-link" data-active={active}>{label}</Link>; })}</nav>
    <span className="nd-header-note">PAIMANA / REGISTER</span>
  </div></header>;
}
