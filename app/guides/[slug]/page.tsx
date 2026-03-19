import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { LobsterCard } from "@/components/lobster-card";
import { buildGuideJsonLd, buildGuideMetadata, getGuide } from "@/lib/guides";
import { categoryLabel, topicLabel } from "@/lib/lobster-taxonomy";
import { getRequestLocale } from "@/lib/server/locale";
import { listLobsters } from "@/lib/server/service";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const guide = getGuide(slug);
  if (!guide) return {};
  return buildGuideMetadata(guide, locale);
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const guide = getGuide(slug);
  if (!guide) notFound();

  const result = await listLobsters({
    page: 1,
    per_page: 6,
    sort: "hot",
    category: guide.relatedCategories?.[0] as never,
    topic: guide.relatedTopics?.[0],
    tag: guide.relatedTags?.[0],
  });

  const jsonLd = buildGuideJsonLd(guide, locale);

  return (
    <div className="page-shell stack-lg">
      <Script
        id={`guide-jsonld-${guide.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="shell page-panel guide-hero">
        <Breadcrumbs
          items={[
            { label: locale === "zh" ? "首页" : "Home", href: "/" },
            { label: locale === "zh" ? "指南" : "Guides" },
            { label: guide.title[locale] },
          ]}
        />
        <div className="stack-md">
          <span className="hero-badge">{locale === "zh" ? "实战指南" : "Practical Guide"}</span>
          <h1 className="page-title">{guide.title[locale]}</h1>
          <p className="guide-intro">{guide.intro[locale]}</p>
        </div>
        <div className="guide-meta-row">
          {guide.relatedCategories?.map((category) => (
            <Link key={category} className="tag tag-category" href={`/categories/${category}`}>
              {categoryLabel(category as never, locale)}
            </Link>
          ))}
          {guide.relatedTopics?.map((topic) => (
            <Link key={topic} className="tag tag-topic" href={`/topics/${topic}`}>
              {topicLabel(topic as never, locale)}
            </Link>
          ))}
          {guide.relatedTags?.map((tag) => (
            <Link key={tag} className="tag" href={`/tags/${encodeURIComponent(tag)}`}>
              #{tag}
            </Link>
          ))}
        </div>
      </section>

      <section className="shell page-panel guide-sections">
        {guide.sections.map((section) => (
          <article key={section.title.en} className="guide-section">
            <h2 className="panel-title">{section.title[locale]}</h2>
            <p className="guide-copy">{section.body[locale]}</p>
          </article>
        ))}
      </section>

      <section className="shell page-panel guide-links">
        <div className="detail-section-head">
          <h2 className="panel-title">{locale === "zh" ? "继续浏览" : "Keep Exploring"}</h2>
        </div>
        <div className="guide-link-grid">
          {guide.relatedCategories?.map((category) => (
            <Link key={`category-${category}`} className="guide-link-card" href={`/categories/${category}`}>
              <strong>{categoryLabel(category as never, locale)}</strong>
              <span>{locale === "zh" ? "查看该类型下的热门龙虾" : "Browse top lobsters in this category"}</span>
            </Link>
          ))}
          {guide.relatedTopics?.map((topic) => (
            <Link key={`topic-${topic}`} className="guide-link-card" href={`/topics/${topic}`}>
              <strong>{topicLabel(topic as never, locale)}</strong>
              <span>{locale === "zh" ? "查看相关主题配置" : "Browse related topic setups"}</span>
            </Link>
          ))}
        </div>
      </section>

      {result.items.length ? (
        <section className="shell page-panel p-5 md:p-6">
          <div className="detail-section-head">
            <h2 className="panel-title">{locale === "zh" ? "相关龙虾" : "Relevant Lobsters"}</h2>
          </div>
          <div className="grid home-lobster-grid detail-related-grid">
            {result.items.map((item) => (
              <LobsterCard key={item.slug} item={item} locale={locale} variant="home" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
