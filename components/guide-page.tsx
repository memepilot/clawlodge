import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { MarkdownContent } from "@/components/markdown-content";
import { buildGuideMetadata, getGuideBySlug } from "@/lib/guides";
import type { Locale } from "@/lib/i18n";
import { categoryLabel, topicLabel } from "@/lib/lobster-taxonomy";
import { localizePath } from "@/lib/locale-routing";
import { absoluteUrl } from "@/lib/site";

export function GuidePage({ slug, locale }: { slug: string; locale: Locale }) {
  const guide = getGuideBySlug(slug, locale);
  if (!guide) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    url: absoluteUrl(localizePath(`/guides/${guide.slug}`, locale)),
  };

  return (
    <div className="page-shell stack-lg">
      <Script
        id={`guide-jsonld-${guide.slug}-${locale}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="shell page-panel p-5 md:p-6">
        <Breadcrumbs
          items={[
            { label: locale === "zh" ? "首页" : locale === "ja" ? "ホーム" : "Home", href: localizePath("/", locale) },
            { label: locale === "zh" ? "指南" : locale === "ja" ? "ガイド" : "Guides", href: localizePath("/guides", locale) },
            { label: guide.title },
          ]}
        />
        <h1 className="page-title">{guide.title}</h1>
        <p className="page-subtitle">{guide.intro}</p>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <MarkdownContent value={guide.markdown} />
      </section>

      {(guide.relatedCategorySlugs?.length || guide.relatedTopicSlugs?.length || guide.relatedLobsterSlugs?.length) ? (
        <section className="shell page-panel p-5 md:p-6">
          <div className="detail-section-head">
            <h2 className="panel-title">{locale === "zh" ? "相关路径" : locale === "ja" ? "関連リンク" : "Related paths"}</h2>
          </div>
          <div className="guide-related-links">
            {guide.relatedCategorySlugs?.map((category) => (
              <Link key={`category-${category}`} className="tag tag-category" href={localizePath(`/categories/${category}`, locale)}>
                {categoryLabel(category as never, locale)}
              </Link>
            ))}
            {guide.relatedTopicSlugs?.map((topic) => (
              <Link key={`topic-${topic}`} className="tag tag-topic" href={localizePath(`/topics/${topic}`, locale)}>
                {topicLabel(topic as never, locale)}
              </Link>
            ))}
            {guide.relatedLobsterSlugs?.map((lobster) => (
              <Link key={`lobster-${lobster}`} className="tag" href={localizePath(`/lobsters/${lobster}`, locale)}>
                {lobster}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export { buildGuideMetadata };
