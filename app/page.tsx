import Script from "next/script";
import Link from "next/link";

import { LobsterCard } from "@/components/lobster-card";
import { apiOrigin } from "@/lib/api";
import { getSessionUser } from "@/lib/server/auth";
import { listLobsters } from "@/lib/server/service";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tag?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const sort = params.sort === "new" ? "new" : "hot";
  const page = Number.isFinite(Number(params.page)) ? Math.max(1, Math.floor(Number(params.page))) : 1;
  const result = await listLobsters({ sort, tag: params.tag, q: params.q, page, per_page: 12 });
  const sessionUser = await getSessionUser();
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
                  placeholder="Search name, tags, README..."
                />
              </div>
              <select className="select" defaultValue={sort} name="sort">
                <option value="hot">Hot</option>
                <option value="new">New</option>
              </select>
              <input className="input" name="tag" defaultValue={params.tag ?? ""} placeholder="Tag filter" />
              <button className="btn btn-primary" type="submit">
                Search
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="hero-badge">OpenClaw, shared.</span>
            <h1 className="hero-title">ClawLodge, the config dock for sharp agents.</h1>
            <p className="hero-subtitle">
                Share OpenClaw configs, AGENTS rules, plugin upload bundles, and reusable workflows in one searchable hub.
            </p>
              <div className="hero-actions">
                <Link className="btn btn-primary" href="/publish">
                  Publish a lobster
                </Link>
                {!sessionUser ? (
                  <a className="btn" href={githubLoginUrl}>
                    Login with GitHub
                  </a>
                ) : null}
              </div>
            </div>

            <div className="hero-card hero-search-card">
              <div className="stat">Search lobsters. Versioned, rollback-ready.</div>
              <form className="search-stack" method="get">
                <div className="search-bar">
                  <span className="mono">/</span>
                  <input className="search-input" name="q" defaultValue={params.q ?? ""} placeholder="Search name, tags, README..." />
                </div>
                <div className="filters-row">
                  <select className="select" defaultValue={sort} name="sort">
                    <option value="hot">Hot</option>
                    <option value="new">New</option>
                  </select>
                  <input className="input" name="tag" defaultValue={params.tag ?? ""} placeholder="Tag filter" />
                  <button className="btn btn-primary" type="submit">
                    Search
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      )}

      <section className={`section ${isTagResults ? "section-tight section-topless" : ""}`}>
        <h2 className="section-title">
          {params.tag ? `Results for #${params.tag}` : "Seeded examples and community uploads"}
        </h2>
        <p className="section-subtitle">
          {params.tag
            ? "Related lobsters grouped by the selected hashtag."
            : "A marketplace for starter configs, curated imports, and production-ready OpenClaw bundles."}
        </p>
        <div className="grid">
          {result.items.length ? (
            result.items.map((item) => <LobsterCard key={item.slug} item={item} />)
          ) : (
            <div className="card muted">No lobster found.</div>
          )}
        </div>
        {result.total_pages > 1 ? (
          <div className="pagination-bar">
            <p className="pagination-summary muted">
              Showing {(result.page - 1) * result.per_page + 1}-{Math.min(result.page * result.per_page, result.total)} of {result.total}
            </p>
            <div className="pagination-actions">
              {result.has_prev ? (
                <Link className="btn" href={buildPageHref(result.page - 1)}>
                  Previous
                </Link>
              ) : (
                <span className="btn pagination-disabled" aria-disabled="true">
                  Previous
                </span>
              )}
              <span className="pagination-current">
                Page {result.page} / {result.total_pages}
              </span>
              {result.has_next ? (
                <Link className="btn btn-primary" href={buildPageHref(result.page + 1)}>
                  Next
                </Link>
              ) : (
                <span className="btn btn-primary pagination-disabled" aria-disabled="true">
                  Next
                </span>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
