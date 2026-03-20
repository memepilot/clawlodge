import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { MarkdownContent } from "@/components/markdown-content";
import { getGuideBySlug, getGuides, buildGuideMetadata } from "@/lib/guides";
import { categoryLabel, topicLabel } from "@/lib/lobster-taxonomy";
import { absoluteUrl } from "@/lib/site";

export function generateStaticParams() {
  return getGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) {
    return {
      title: "Guide",
      alternates: {
        canonical: absoluteUrl(`/guides/${slug}`),
      },
    };
  }
  return buildGuideMetadata(guide);
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    url: absoluteUrl(`/guides/${guide.slug}`),
  };

  return (
    <div className="page-shell stack-lg">
      <Script
        id={`guide-jsonld-${guide.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="shell page-panel p-5 md:p-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Guides", href: "/guides" },
            { label: guide.title },
          ]}
        />
        <div className="detail-kickers">
          <span className="tag tag-topic">Guide</span>
        </div>
        <h1 className="page-title">{guide.title}</h1>
        <p className="page-subtitle">{guide.intro}</p>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <MarkdownContent value={guide.markdown} />
      </section>

      {(guide.relatedCategorySlugs?.length || guide.relatedTopicSlugs?.length || guide.relatedLobsterSlugs?.length) ? (
        <section className="shell page-panel p-5 md:p-6">
          <div className="detail-section-head">
            <h2 className="panel-title">Related paths</h2>
          </div>
          <div className="guide-related-links">
            {guide.relatedCategorySlugs?.map((category) => (
              <Link key={`category-${category}`} className="tag tag-category" href={`/categories/${category}`}>
                {categoryLabel(category as never, "en")}
              </Link>
            ))}
            {guide.relatedTopicSlugs?.map((topic) => (
              <Link key={`topic-${topic}`} className="tag tag-topic" href={`/topics/${topic}`}>
                {topicLabel(topic as never, "en")}
              </Link>
            ))}
            {guide.relatedLobsterSlugs?.map((lobster) => (
              <Link key={`lobster-${lobster}`} className="tag" href={`/lobsters/${lobster}`}>
                {lobster}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
