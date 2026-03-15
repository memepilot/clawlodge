import Link from "next/link";
import Script from "next/script";

import { LobsterCard } from "@/components/lobster-card";
import { buildCollectionJsonLd } from "@/lib/lobster-taxonomy";
import { getTranslations } from "@/lib/i18n";
import type { LobsterListResult } from "@/lib/types";

type Props = {
  locale: "en" | "zh";
  title: string;
  intro: string;
  pathname: string;
  result: LobsterListResult;
  sort: "hot" | "new";
  buildPageHref: (page: number) => string;
};

export function LobsterCollectionPage({
  locale,
  title,
  intro,
  pathname,
  result,
  sort,
  buildPageHref,
}: Props) {
  const t = getTranslations(locale);
  const structuredData = buildCollectionJsonLd({
    title,
    description: intro,
    pathname,
  });

  return (
    <div>
      <Script
        id={`collection-jsonld-${pathname.replace(/[^\w-]+/g, "-")}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="hero hero-compact">
        <div className="hero-inner">
          <div className="hero-copy">
            <h1 className="hero-title">{title}</h1>
            <p className="hero-subtitle">{intro}</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="home-results-bar">
          <p className="home-results-summary">
            {t.home.showing} {result.total} {locale === "zh" ? "个" : "items"}
          </p>
          {sort !== "hot" ? (
            <Link className="home-clear-link" href={pathname}>
              {locale === "zh" ? "查看热门排序" : "view hot ranking"}
            </Link>
          ) : null}
        </div>

        <div className="grid home-lobster-grid">
          {result.items.length ? (
            result.items.map((item) => <LobsterCard key={item.slug} item={item} locale={locale} variant="home" />)
          ) : (
            <div className="card muted">{t.home.noResults}</div>
          )}
        </div>

        {result.total_pages > 1 ? (
          <div className="pagination-bar">
            <p className="pagination-summary muted">
              {t.home.showing} {(result.page - 1) * result.per_page + 1}-{Math.min(result.page * result.per_page, result.total)} / {result.total}
            </p>
            <div className="pagination-actions">
              {result.has_prev ? (
                <Link className="btn" href={buildPageHref(result.page - 1)}>
                  {t.home.previous}
                </Link>
              ) : (
                <span className="btn pagination-disabled" aria-disabled="true">
                  {t.home.previous}
                </span>
              )}
              <span className="pagination-current">
                {t.home.page} {result.page} / {result.total_pages}
              </span>
              {result.has_next ? (
                <Link className="btn btn-primary" href={buildPageHref(result.page + 1)}>
                  {t.home.next}
                </Link>
              ) : (
                <span className="btn btn-primary pagination-disabled" aria-disabled="true">
                  {t.home.next}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
