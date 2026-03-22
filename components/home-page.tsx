import Link from "next/link";
import Script from "next/script";

import { ExploreLinks } from "@/components/explore-links";
import { LobsterCard } from "@/components/lobster-card";
import { PaginationBar } from "@/components/pagination-bar";
import { CATEGORY_OPTIONS, TOPIC_OPTIONS, categoryLabel, topicLabel } from "@/lib/lobster-taxonomy";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n";
import { localizePath } from "@/lib/locale-routing";
import { listLobsters } from "@/lib/server/service";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { LobsterCategory } from "@/lib/types";

type HomePageProps = {
  locale: Locale;
  searchParams: { sort?: string; tag?: string; q?: string; category?: string; page?: string };
};

export async function HomePage({ locale, searchParams: params }: HomePageProps) {
  const featuredTopics = TOPIC_OPTIONS.filter((option) => ["dev", "multiagent", "automation", "design", "research"].includes(option.value));
  const featuredTags = ["openclaw", "dev", "memory", "config", "agents", "workflow"];
  const defaultSort = "downloads";
  const sort = params.sort === "new" ? "new" : defaultSort;
  const page = Number.isFinite(Number(params.page)) ? Math.max(1, Math.floor(Number(params.page))) : 1;
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
  const isTagResults = Boolean(params.tag);
  const rootPath = localizePath("/", locale);
  const buildPageHref = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q?.trim()) search.set("q", params.q.trim());
    if (params.tag?.trim()) search.set("tag", params.tag.trim());
    if (selectedCategory) search.set("category", selectedCategory);
    if (sort !== defaultSort) search.set("sort", sort);
    if (nextPage > 1) search.set("page", String(nextPage));
    const query = search.toString();
    return query ? `${rootPath}?${query}` : rootPath;
  };
  const buildCategoryHref = (category?: LobsterCategory) => {
    const search = new URLSearchParams();
    if (sort !== defaultSort) search.set("sort", sort);
    const query = search.toString();
    if (!category) return query ? `${rootPath}?${query}` : rootPath;
    const target = localizePath(`/categories/${category}`, locale);
    return query ? `${target}?${query}` : target;
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
        url: absoluteUrl(rootPath),
        description: siteConfig.description,
        potentialAction: {
          "@type": "SearchAction",
          target: `${absoluteUrl(rootPath)}?q={search_term_string}`,
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
              <Link className="btn" href={localizePath("/guides/openclaw-multi-agent-config", locale)}>
                {t.home.guidesCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={`section ${isTagResults ? "section-tight section-topless" : ""}`}>
        <div className="home-toolbar">
          <div className="home-toolbar-copy">
            <form className="home-inline-search" method="get" action={rootPath}>
              <div className="search-bar home-inline-search-bar">
                <span className="home-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20">
                    <circle cx="8.5" cy="8.5" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <path d="m12.7 12.7 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <input className="search-input" name="q" defaultValue={params.q ?? ""} placeholder={t.home.searchPlaceholder} />
              </div>
              <input type="hidden" name="sort" value={sort} />
              {params.tag?.trim() ? <input type="hidden" name="tag" value={params.tag.trim()} /> : null}
              {selectedCategory ? <input type="hidden" name="category" value={selectedCategory} /> : null}
            </form>
          </div>
          <div className="home-category-filter" aria-label="Category filter">
            <Link className={`home-category-pill ${!selectedCategory ? "is-active" : ""}`} href={buildCategoryHref()}>
              <span className="home-category-icon">◍</span>
              <span>{locale === "zh" ? "全部" : locale === "ja" ? "すべて" : "All"}</span>
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
          <h2 className="section-title">{t.home.popularSetups}</h2>
          <div className="home-results-meta">
            <p className="home-results-summary">
              {t.home.showing} {result.total} {locale === "zh" ? "个" : locale === "ja" ? "件" : "items"}
            </p>
            {(params.q?.trim() || params.tag?.trim() || selectedCategory || sort !== defaultSort) ? (
              <Link className="home-clear-link" href={rootPath}>
                {locale === "zh" ? "清除筛选" : locale === "ja" ? "絞り込みを解除" : "clear filters"}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="grid home-lobster-grid">
          {result.items.length ? (
            result.items.map((item, index) => (
              <LobsterCard key={item.slug} item={item} locale={locale} variant="home" eagerIcon={index < 12} />
            ))
          ) : (
            <div className="card muted">{t.home.noResults}</div>
          )}
        </div>
        <PaginationBar
          labels={{
            showing: t.home.showing,
            previous: t.home.previous,
            next: t.home.next,
            page: t.home.page,
            jumpTo: t.home.jumpTo,
            go: t.home.go,
          }}
          result={result}
          buildPageHref={buildPageHref}
          action={rootPath}
          inputId={`page-jump-home-${locale}`}
          hiddenFields={[
            ...(params.q?.trim() ? [{ name: "q", value: params.q.trim() }] : []),
            ...(params.tag?.trim() ? [{ name: "tag", value: params.tag.trim() }] : []),
            ...(selectedCategory ? [{ name: "category", value: selectedCategory }] : []),
            ...(sort !== defaultSort ? [{ name: "sort", value: sort }] : []),
          ]}
        />
        <ExploreLinks
          locale={locale}
          rows={[
            {
              label: locale === "zh" ? "主题" : locale === "ja" ? "トピック" : "Topics",
              items: featuredTopics.map((topic) => ({
                key: topic.value,
                href: `/topics/${topic.value}`,
                text: topicLabel(topic.value, locale),
                className: "tag tag-topic home-explore-chip",
              })),
            },
            {
              label: locale === "zh" ? "标签" : locale === "ja" ? "タグ" : "Tags",
              items: featuredTags.map((tag) => ({
                key: tag,
                href: `/tags/${encodeURIComponent(tag)}`,
                text: `#${tag}`,
                className: "tag home-explore-chip",
              })),
            },
          ]}
        />
      </section>
    </div>
  );
}
