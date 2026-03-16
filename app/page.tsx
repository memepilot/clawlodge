import Script from "next/script";
import Link from "next/link";

import { LobsterCard } from "@/components/lobster-card";
import { CATEGORY_OPTIONS, categoryLabel } from "@/lib/lobster-taxonomy";
import { apiOrigin } from "@/lib/api";
import { getTranslations } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server/locale";
import { listLobsters } from "@/lib/server/service";
import { LobsterCategory } from "@/lib/types";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const revalidate = 300;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tag?: string; q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const sort = params.sort === "new" ? "new" : "hot";
  const page = Number.isFinite(Number(params.page)) ? Math.max(1, Math.floor(Number(params.page))) : 1;
  const locale = await getRequestLocale();
  const t = getTranslations(locale);
  const selectedCategory = CATEGORY_OPTIONS.some((option) => option.value === params.category) ? (params.category as LobsterCategory) : undefined;
  const result = await listLobsters({
    sort,
    tag: params.tag,
    q: params.q,
    category: selectedCategory,
    page,
    per_page: 18,
  });
  const githubLoginUrl = `${apiOrigin}/api/v1/auth/github/start?next=/publish`;
  const isTagResults = Boolean(params.tag);
  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q?.trim()) search.set("q", params.q.trim());
    if (params.tag?.trim()) search.set("tag", params.tag.trim());
    if (selectedCategory) search.set("category", selectedCategory);
    if (sort !== "hot") search.set("sort", sort);
    if (nextPage > 1) search.set("page", String(nextPage));
    const query = search.toString();
    return query ? `/?${query}` : "/";
  };
  const buildCategoryHref = (category?: LobsterCategory) => {
    const search = new URLSearchParams();
    if (sort !== "hot") search.set("sort", sort);
    const query = search.toString();
    if (!category) return query ? `/?${query}` : "/";
    return query ? `/categories/${category}?${query}` : `/categories/${category}`;
  };
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: siteConfig.name,
        url: siteConfig.origin,
        sameAs: [siteConfig.githubUrl],
      },
      {
        "@type": "WebSite",
        name: siteConfig.name,
        url: siteConfig.origin,
        description: siteConfig.description,
        potentialAction: {
          "@type": "SearchAction",
          target: `${absoluteUrl("/")}?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <div>
      <Script
        id="home-jsonld"
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

      <section className={`section ${isTagResults ? "section-tight section-topless" : ""}`}>
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
                <input
                  className="search-input"
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder={t.home.searchPlaceholder}
                />
              </div>
              <input type="hidden" name="sort" value={sort} />
              {params.tag?.trim() ? <input type="hidden" name="tag" value={params.tag.trim()} /> : null}
              {selectedCategory ? <input type="hidden" name="category" value={selectedCategory} /> : null}
            </form>
          </div>
          <div className="home-category-filter" aria-label="Category filter">
            <Link
              className={`home-category-pill ${!selectedCategory ? "is-active" : ""}`}
              href={buildCategoryHref()}
            >
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
          {(params.q?.trim() || params.tag?.trim() || selectedCategory || sort !== "hot") ? (
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
