import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: { default: "Nirman Drushti", template: "%s | Nirman Drushti" },
  description: "Infrastructure project monitoring from validated PAIMANA records.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><Header /><main className="nd-main">{children}</main><footer className="nd-footer"><div className="nd-container">NIRMAN DRUSHTI / INFRASTRUCTURE MONITORING REGISTER</div></footer></body></html>;
}
