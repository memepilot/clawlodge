import Link from "next/link";

import { LobsterSummary } from "@/lib/types";

export function LobsterCard({ item }: { item: LobsterSummary }) {
  return (
    <article className="card lobster-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="lobster-card-meta">
            {item.source_type ? <span className={`tag tag-source`}>{item.source_type}</span> : null}
            {item.verified ? <span className="tag tag-verified">verified</span> : null}
          </div>
          <h3 className="lobster-card-title">
            <Link href={`/lobsters/${item.slug}`}>{item.name}</Link>
          </h3>
          <p className="muted text-sm">by @{item.owner_handle}</p>
        </div>
        <div className="lobster-card-side">
          <div className="mono">{item.latest_version ? `v${item.latest_version}` : "no version"}</div>
          <div>{item.license}</div>
        </div>
      </div>
      <p className="lobster-card-summary">{item.summary}</p>
      {item.curation_note ? <p className="lobster-card-note">{item.curation_note}</p> : null}
      <div className="lobster-card-tags">
        {item.tags.map((tag) => (
          <span key={tag} className="tag">
            #{tag}
          </span>
        ))}
      </div>
      <div className="lobster-card-footer">
        <span className="stat">Hot {item.hot_score.toFixed(2)}</span>
        <span className="stat">Fav {item.favorite_count}</span>
        <span className="stat">Comments {item.comment_count}</span>
        {item.is_hireable ? <span className="stat accent">Hireable</span> : null}
      </div>
    </article>
  );
}
