import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Bricolage_Grotesque, IBM_Plex_Mono, Manrope } from "next/font/google";

import { HeaderAuth } from "@/components/header-auth";

import "./globals.css";

const displayFont = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const bodyFont = Manrope({ subsets: ["latin"], variable: "--font-body" });
const monoFont = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: "400" });

export const metadata: Metadata = {
  title: "ClawLodge",
  description: "OpenClaw lobster sharing platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body style={{ fontFamily: "var(--font-body)" }}>
        <header className="navbar">
          <div className="navbar-inner">
            <Link href="/" className="brand-name">
              <span className="brand-mark" aria-hidden="true">
                <Image src="/logo-mark.svg" alt="" width={36} height={36} className="brand-mark-image" priority />
              </span>
              <span className="brand-copy">ClawLodge</span>
            </Link>
            <nav className="nav-links">
              <Link href="/publish">Publish</Link>
              <Link href="/mcp">Plugin Upload</Link>
              <Link href="/settings">Settings</Link>
            </nav>
            <div className="nav-actions">
              <HeaderAuth />
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
