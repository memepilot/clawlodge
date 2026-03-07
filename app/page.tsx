import Link from "next/link";

import { LobsterCard } from "@/components/lobster-card";
import { apiOrigin } from "@/lib/api";
import { getSessionUser } from "@/lib/server/auth";
import { listLobsters } from "@/lib/server/service";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tag?: string; q?: string }>;
}) {
  const params = await searchParams;
  const sort = params.sort === "new" ? "new" : "hot";
  const result = await listLobsters({ sort, tag: params.tag, q: params.q });
  const sessionUser = await getSessionUser();
  const githubLoginUrl = `${apiOrigin}/api/v1/auth/github/start?next=/publish`;
  const isTagResults = Boolean(params.tag);

  return (
    <div>
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
      </section>
    </div>
  );
}
