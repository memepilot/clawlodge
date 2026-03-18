import Link from "next/link";
import Script from "next/script";

import { LobsterCard } from "@/components/lobster-card";
import { apiOrigin } from "@/lib/api";
import { buildCollectionJsonLd, CATEGORY_OPTIONS, categoryLabel } from "@/lib/lobster-taxonomy";
import { getTranslations } from "@/lib/i18n";
import { siteConfig } from "@/lib/site";
import type { LobsterCategory, LobsterListResult } from "@/lib/types";

type Props = {
  locale: "en" | "zh";
  title: string;
  intro: string;
  pathname: string;
  result: LobsterListResult;
  sort: "hot" | "new";
  buildPageHref: (page: number) => string;
  selectedCategory?: LobsterCategory;
};

export function LobsterCollectionPage({
  locale,
  title,
  intro,
  pathname,
  result,
  sort,
  buildPageHref,
  selectedCategory,
}: Props) {
  const t = getTranslations(locale);
  const githubLoginUrl = `${apiOrigin}/api/v1/auth/github/start?next=/publish`;
  const structuredData = buildCollectionJsonLd({
    title,
    description: intro,
    pathname,
  });
  const buildCategoryHref = (category?: LobsterCategory) => {
    const search = new URLSearchParams();
    if (sort !== "hot") search.set("sort", sort);
    const query = search.toString();
    if (!category) return query ? `/?${query}` : "/";
    return query ? `/categories/${category}?${query}` : `/categories/${category}`;
  };

  return (
    <div>
      <Script
        id={`collection-jsonld-${pathname.replace(/[^\w-]+/g, "-")}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-badge">{t.home.badge}</span>
            <h1 className="hero-title">{t.home.title}</h1>
            <p className="hero-subtitle">{t.home.subtitle}</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/publish">
                {t.home.publishCta}
              </Link>
              <a className="btn" href={siteConfig.npmCliUrl} target="_blank" rel="noreferrer">
                {t.nav.installCli}
              </a>
              <a className="btn" href={githubLoginUrl}>
                {t.auth.loginWithGithub}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="home-toolbar">
          <div className="home-toolbar-copy">
            <form className="home-inline-search" method="get" action="/">
              <div className="search-bar home-inline-search-bar">
                <span className="home-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20">
                    <circle cx="8.5" cy="8.5" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <path d="m12.7 12.7 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <input className="search-input" name="q" placeholder={t.home.searchPlaceholder} />
              </div>
              <input type="hidden" name="sort" value={sort} />
              {selectedCategory ? <input type="hidden" name="category" value={selectedCategory} /> : null}
            </form>
          </div>
          <div className="home-category-filter" aria-label="Category filter">
            <Link className={`home-category-pill ${!selectedCategory ? "is-active" : ""}`} href={buildCategoryHref()}>
              <span className="home-category-icon">◍</span>
              <span>{locale === "zh" ? "全部" : "All"}</span>
            </Link>
            {CATEGORY_OPTIONS.map((option) => (
              <Link
                key={option.value}
                className={`home-category-pill ${selectedCategory === option.value ? "is-active" : ""}`}
                href={buildCategoryHref(option.value)}
              >
                <span className="home-category-icon">{option.icon}</span>
                <span>{categoryLabel(option.value, locale)}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="home-results-bar">
          <p className="home-results-summary">
            {t.home.showing} {result.total} {locale === "zh" ? "个" : "items"}
          </p>
          {(selectedCategory || sort !== "hot") ? (
            <Link className="home-clear-link" href="/">
              {locale === "zh" ? "清除筛选" : "clear filters"}
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
