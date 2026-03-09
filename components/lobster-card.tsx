import Link from "next/link";

import { getDisplayAuthor, getDisplayLobsterName } from "@/lib/lobster-display";
import { LobsterSummary } from "@/lib/types";

function sourceTypeLabel(value: LobsterSummary["source_type"]) {
  switch (value) {
    case "official":
      return "official";
    case "curated":
      return "curated";
    case "community":
      return "community upload";
    case "demo":
      return "demo";
    default:
      return value;
  }
}

export function LobsterCard({ item }: { item: LobsterSummary }) {
  const displayName = getDisplayLobsterName(item);
  const author = getDisplayAuthor(item);
  return (
    <article className="card lobster-card">
      {item.recommended ? (
        <div className="lobster-card-ribbon" aria-label="Recommended">
          <span>Recommended</span>
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="lobster-card-meta">
            {item.source_type ? <span className={`tag tag-source`}>{sourceTypeLabel(item.source_type)}</span> : null}
            {item.verified ? <span className="tag tag-verified">verified</span> : null}
          </div>
          <h3 className="lobster-card-title">
            <Link href={`/lobsters/${item.slug}`}>{displayName}</Link>
          </h3>
          <p className="muted text-sm">
            by{" "}
            {author.href ? (
              <Link className="inline-link" href={author.href}>
                {author.label}
              </Link>
            ) : (
              author.label
            )}
            {author.suffix ?? null}
          </p>
        </div>
        <div className="lobster-card-side">
          <div className="mono">{item.latest_version ? `v${item.latest_version}` : "no version"}</div>
          <div>{item.license}</div>
        </div>
      </div>
      <p className="lobster-card-summary lobster-card-summary-clamped">{item.summary}</p>
      {item.curation_note ? <p className="lobster-card-note">{item.curation_note}</p> : null}
      <div className="lobster-card-tags">
        {item.tags.map((tag) => (
          <Link key={tag} className="tag" href={`/?tag=${encodeURIComponent(tag)}`}>
            #{tag}
          </Link>
        ))}
      </div>
      <div className="lobster-card-footer">
        <span className="stat-chip" aria-label={`${item.favorite_count} favorites`}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 16.2 3.5 9.9a4.1 4.1 0 0 1 5.8-5.8L10 4.8l.7-.7a4.1 4.1 0 1 1 5.8 5.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{item.favorite_count}</span>
        </span>
        <span className="stat-chip" aria-label={`${item.share_count} shares`}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7.2 10.2 12.8 6.8M7.2 9.8l5.6 3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="5.4" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="14.8" cy="5.6" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="14.8" cy="14.4" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <span>{item.share_count}</span>
        </span>
        <span className="stat-chip" aria-label={`${item.comment_count} comments`}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4.2 5.4h11.6a1.8 1.8 0 0 1 1.8 1.8v6a1.8 1.8 0 0 1-1.8 1.8H9.1l-3.7 2.8v-2.8H4.2a1.8 1.8 0 0 1-1.8-1.8v-6a1.8 1.8 0 0 1 1.8-1.8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{item.comment_count}</span>
        </span>
      </div>
    </article>
  );
}
