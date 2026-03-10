import type { Metadata } from "next";

import { getTranslations } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server/locale";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy notes for ClawLodge, including stored data, uploads, and support contact routes.",
  alternates: {
    canonical: absoluteUrl("/privacy"),
  },
};

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const t = getTranslations(locale);
  return (
    <div className="page-shell">
      <section className="shell page-panel p-6 md:p-8">
        <p className="field-label">{t.privacy.label}</p>
        <h1 className="page-title mt-3">{t.privacy.title}</h1>
        <div className="mt-5 stack-md">
          <p className="page-subtitle">{t.privacy.p1}</p>
          <p className="page-subtitle">{t.privacy.p2}</p>
          <p className="page-subtitle">
            {t.privacy.p3Prefix}{" "}
            <a className="inline-link" href={`${siteConfig.githubUrl}/issues`} target="_blank" rel="noreferrer">
              {siteConfig.githubUrl}/issues
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
