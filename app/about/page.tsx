import type { Metadata } from "next";

import { getTranslations } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server/locale";
import { absoluteUrl, buildSocialImages, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn what ClawLodge is and how it helps people share, discover, and reuse powerful OpenClaw setups.",
  alternates: {
    canonical: absoluteUrl("/about"),
  },
  openGraph: {
    title: "About | ClawLodge",
    description: "Learn what ClawLodge is and how it helps people share, discover, and reuse powerful OpenClaw setups.",
    url: absoluteUrl("/about"),
    siteName: siteConfig.name,
    type: "article",
    images: buildSocialImages(null, "About ClawLodge preview"),
  },
  twitter: {
    card: "summary_large_image",
    title: "About | ClawLodge",
    description: "Learn what ClawLodge is and how it helps people share, discover, and reuse powerful OpenClaw setups.",
    images: buildSocialImages(null, "About ClawLodge preview").map((image) => image.url),
  },
};

export default async function AboutPage() {
  const locale = await getRequestLocale();
  const t = getTranslations(locale);
  return (
    <div className="page-shell">
      <section className="shell page-panel p-6 md:p-8">
        <p className="field-label">{t.about.label}</p>
        <h1 className="page-title mt-3">{t.about.title}</h1>
        <div className="mt-5 stack-md">
          <p className="page-subtitle">{t.about.p1}</p>
          <p className="page-subtitle">{t.about.p2}</p>
          <p className="page-subtitle">
            {t.about.p3Prefix}{" "}
            <a className="inline-link" href={siteConfig.origin} target="_blank" rel="noreferrer">
              {siteConfig.origin}
            </a>{" "}
            {t.about.p3Middle}{" "}
            <a className="inline-link" href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
