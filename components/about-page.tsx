import Script from "next/script";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { MarkdownContent } from "@/components/markdown-content";
import type { Locale } from "@/lib/i18n";
import { localizePath } from "@/lib/locale-routing";
import { absoluteUrl } from "@/lib/site";

import { buildAboutMetadata, getAboutPage } from "@/lib/about";

export function AboutPage({ locale }: { locale: Locale }) {
  const page = getAboutPage(locale);
  const pathname = localizePath("/about", locale);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    headline: page.title,
    description: page.description,
    url: absoluteUrl(pathname),
  };

  return (
    <div className="page-shell stack-lg">
      <Script
        id={`about-jsonld-${locale}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="shell page-panel p-5 md:p-6">
        <Breadcrumbs
          items={[
            { label: locale === "zh" ? "首页" : locale === "ja" ? "ホーム" : locale === "fr" ? "Accueil" : "Home", href: localizePath("/", locale) },
            { label: page.label },
          ]}
        />
        <p className="field-label">{page.label}</p>
        <h1 className="page-title mt-3">{page.title}</h1>
        <p className="page-subtitle mt-3">{page.intro}</p>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <MarkdownContent value={page.markdown} />
      </section>
    </div>
  );
}

export { buildAboutMetadata };
