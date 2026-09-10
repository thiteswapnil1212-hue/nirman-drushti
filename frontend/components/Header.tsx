"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

import logo from "@/components/4.png";
import drushtiAiLogo from "@/components/Drushti AI logo icon.png";

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

  const navigationRef = useRef<HTMLElement>(null);

  /*
   * Keep the navigation positioned at the beginning
   * whenever the route changes.
   *
   * This prevents the navbar from remaining horizontally
   * offset after navigating between pages.
   */
  useLayoutEffect(() => {
    const navigation = navigationRef.current;

    if (!navigation) return;

    navigation.scrollLeft = 0;
  }, [pathname]);

  /*
   * Project dossier routes:
   *
   * /projects/123
   * /projects/abc-project
   *
   * But not:
   * /projects
   * /projects/123/details
   */
  const projectRouteParts = pathname
    .split("/")
    .filter(Boolean);
  const projectId =
    projectRouteParts[0] === "projects" &&
    projectRouteParts.length === 2
      ? projectRouteParts[1]
      : null;
  const isProjectDossier = projectId !== null;

  const openAssistant = () => {
    window.dispatchEvent(
      new CustomEvent("drushti-ai:open", {
        detail: { projectId },
      }),
    );
  };

  const isActiveRoute = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  };

  return (
    <header className="nd-header">
      <div className="nd-header-inner">

        {/* =================================================
            BRAND
        ================================================= */}

        <Link
          href="/"
          className="nd-brand"
          aria-label="Nirman Drushti home"
        >
          <span className="nd-brand-mark">
            <Image
              src={logo}
              alt="Nirman Drushti"
              width={40}
              height={40}
              priority
              className="nd-brand-logo"
            />
          </span>

          <span className="nd-brand-copy">
            <span className="nd-brand-title">
              Nirman Drushti
            </span>

            <span className="nd-brand-subtitle">
              Infrastructure monitoring
            </span>
          </span>
        </Link>

        {/* =================================================
            PRIMARY NAVIGATION
        ================================================= */}

        <div className="nd-navigation-shell">
          <nav
            ref={navigationRef}
            className="nd-navigation"
            aria-label="Primary navigation"
          >
            <div className="nd-navigation-track">
              {navigation.map(([href, label]) => {
                const active = isActiveRoute(href);

                return (
                  <Link
                    key={href}
                    href={href}
                    className="nd-navigation-link"
                    data-active={active}
                    aria-current={
                      active ? "page" : undefined
                    }
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>

        {/* =================================================
            DRUSHTI AI
        ================================================= */}

        <div className="nd-header-ai">
          <div className="nd-header-ai-control">
            {isProjectDossier ? (
            <button
              type="button"
              className="nd-header-ai-button"
              data-drushti-ai-launcher="true"
              aria-label="Open Drushti AI project intelligence assistant"
              aria-haspopup="dialog"
              title="DRUSHTI AI"
              onClick={openAssistant}
            >
              <Image
                src={drushtiAiLogo}
                alt=""
                width={30}
                height={30}
                className="nd-header-ai-logo"
              />
            </button>
            ) : (
              <span
                className="nd-header-ai-button nd-header-ai-inactive"
                aria-label="Drushti AI available on project dossiers"
                title="Open Drushti AI from a project dossier"
              >
                <Image
                  src={drushtiAiLogo}
                  alt=""
                  width={30}
                  height={30}
                  className="nd-header-ai-logo"
                />
              </span>
            )}

            <span className="nd-header-ai-label">DRUSHTI AI</span>
            <span className="nd-header-ai-mobile-label">AI</span>
          </div>
        </div>
      </div>
    </header>
  );
}
