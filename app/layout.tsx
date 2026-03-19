import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Bricolage_Grotesque, IBM_Plex_Mono, Manrope } from "next/font/google";

import { HeaderAuth } from "@/components/header-auth";
import { LocaleProvider } from "@/components/locale-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getTranslations } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server/locale";
import { absoluteUrl, buildSocialImages, siteConfig } from "@/lib/site";

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
    images: buildSocialImages(null, `${siteConfig.name} homepage preview`),
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: buildSocialImages(null, `${siteConfig.name} homepage preview`).map((image) => image.url),
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  const t = getTranslations(locale);

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"} className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body style={{ fontFamily: "var(--font-body)" }}>
        <LocaleProvider locale={locale} messages={t}>
          <header className="navbar">
            <div className="navbar-inner">
              <Link href="/" className="brand-name">
                <span className="brand-mark">
                  <Image src="/logo-mark.svg" alt="ClawLodge logo" width={36} height={36} className="brand-mark-image" priority />
                </span>
                <span className="brand-copy">{t.brand.name}</span>
              </Link>
              <nav className="nav-links">
                <Link href="/publish">{t.nav.publish}</Link>
                <Link href="/mcp">{t.nav.pluginUpload}</Link>
                <Link href="/settings">{t.nav.settings}</Link>
                <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
                  {t.nav.github}
                </a>
              </nav>
              <div className="nav-actions">
                <LocaleSwitcher />
                <HeaderAuth />
              </div>
            </div>
          </header>
          <main>{children}</main>
          <footer className="shell page-panel mt-8 mb-8 p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="muted">{t.brand.footer}</div>
              <div className="flex flex-wrap gap-4">
                <Link className="inline-link" href="/about">
                  {t.nav.about}
                </Link>
                <Link className="inline-link" href="/privacy">
                  {t.nav.privacy}
                </Link>
                <a className="inline-link" href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
                  {t.nav.github}
                </a>
                <a className="inline-link" href={siteConfig.xUrl} target="_blank" rel="noreferrer">
                  {t.nav.twitter}
                </a>
                <a className="inline-link" href={siteConfig.npmCliUrl} target="_blank" rel="noreferrer">
                  {t.nav.installCli}
                </a>
              </div>
            </div>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
