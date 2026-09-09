"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import logo from "@/components/4.png";

const navigation = [
  ["/", "Home"],
  ["/platform", "Platform"],
  ["/projects", "Projects"],
  ["/cost-intelligence", "Cost Intelligence"],
  ["/progress-intelligence", "Progress"],
  ["/risk-intelligence", "Risk Intelligence"],
  ["/early-warnings", "Early Warnings"],
  ["/analytics", "Analytics"],
  ["/model-evaluation", "Model Evaluation"],
  ["/what-if", "What-If"],
  ["/data", "Data"],
] as const;

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="nd-header">
      <div className="nd-header-inner">
        {/* Brand */}
        <Link
          href="/"
          className="nd-brand"
          aria-label="Nirman Drushti home"
        >
          <span className="nd-brand-mark">
            <Image
              src={logo}
              alt="Nirman Drushti logo"
              width={42}
              height={42}
              priority
              className="nd-brand-logo"
            />
          </span>

          <span className="nd-brand-copy">
            <span className="nd-brand-title">
              Nirman Drushti
            </span>

            <span className="nd-brand-subtitle">
              Infrastructure Intelligence
            </span>
          </span>
        </Link>

        {/* Primary navigation */}
        <nav
          className="nd-navigation"
          aria-label="Primary navigation"
        >
          {navigation.map(([href, label]) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href ||
                  pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                className="nd-navigation-link"
                data-active={active}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* System label */}
        <div className="nd-header-meta">
          <span
            className="nd-header-status"
            aria-hidden="true"
          />

          <span className="nd-header-note">
            PAIMANA / REGISTER
          </span>
        </div>
      </div>
    </header>
  );
}