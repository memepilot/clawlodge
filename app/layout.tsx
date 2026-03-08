import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Bricolage_Grotesque, IBM_Plex_Mono, Manrope } from "next/font/google";

import { HeaderAuth } from "@/components/header-auth";
import { absoluteUrl, siteConfig } from "@/lib/site";

import "./globals.css";

const displayFont = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const bodyFont = Manrope({ subsets: ["latin"], variable: "--font-body" });
const monoFont = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.origin),
  title: {
    default: siteConfig.title,
    template: "%s | ClawLodge",
  },
  description: siteConfig.description,
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
  },
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
        <footer className="shell page-panel mt-8 mb-8 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="muted">ClawLodge is an OpenClaw workspace directory and publishing hub.</div>
            <div className="flex flex-wrap gap-4">
              <Link className="inline-link" href="/about">
                About
              </Link>
              <Link className="inline-link" href="/privacy">
                Privacy
              </Link>
              <a className="inline-link" href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
