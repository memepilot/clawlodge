import Script from "next/script";
import Link from "next/link";

import { LobsterCard } from "@/components/lobster-card";
import { SearchBand } from "@/components/search-band";
import { apiOrigin } from "@/lib/api";
import { getTranslations } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server/locale";
import { listLobsters } from "@/lib/server/service";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const revalidate = 300;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tag?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const sort = params.sort === "new" ? "new" : "hot";
  const page = Number.isFinite(Number(params.page)) ? Math.max(1, Math.floor(Number(params.page))) : 1;
  const result = await listLobsters({ sort, tag: params.tag, q: params.q, page, per_page: 12 });
  const locale = await getRequestLocale();
  const t = getTranslations(locale);
  const githubLoginUrl = `${apiOrigin}/api/v1/auth/github/start?next=/publish`;
  const isTagResults = Boolean(params.tag);
  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q?.trim()) search.set("q", params.q.trim());
    if (params.tag?.trim()) search.set("tag", params.tag.trim());
    if (sort !== "hot") search.set("sort", sort);
    if (nextPage > 1) search.set("page", String(nextPage));
    const query = search.toString();
    return query ? `/?${query}` : "/";
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
      {isTagResults ? (
        <section className="section section-tight">
          <div className="tag-results-bar hero-card">
            <form className="tag-results-form" method="get">
              <div className="search-bar">
                <span className="mono">/</span>
                <input
                  className="search-input"
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder={t.home.searchPlaceholder}
                />
              </div>
              <div className="search-controls-row">
                <select className="select" defaultValue={sort} name="sort">
                  <option value="hot">Hot</option>
                  <option value="new">New</option>
                </select>
                {params.tag?.trim() ? <input type="hidden" name="tag" value={params.tag.trim()} /> : null}
                <button className="btn btn-primary search-submit" type="submit">
                  {t.home.searchButton}
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : (
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
          <SearchBand
            defaultQuery={params.q ?? ""}
            placeholder={t.home.searchPlaceholder}
            buttonLabel={t.home.searchButton}
            helperText={t.home.searchStat}
            includeSort
            sortValue={sort}
          />
        </section>
      )}

      <section className={`section ${isTagResults ? "section-tight section-topless" : ""}`}>
        <h2 className="section-title">
          {params.tag ? `${t.home.tagResultsPrefix}${params.tag}` : t.home.seededTitle}
        </h2>
        <p className="section-subtitle">
          {params.tag
            ? t.home.tagResultsSubtitle
            : t.home.seededSubtitle}
        </p>
        <div className="grid">
          {result.items.length ? (
            result.items.map((item) => <LobsterCard key={item.slug} item={item} locale={locale} />)
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
