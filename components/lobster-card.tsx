import Link from "next/link";

import { LobsterAvatar } from "@/components/lobster-avatar";
import { Locale, getTranslations } from "@/lib/i18n";
import { categoryLabel as localizedCategoryLabel, topicLabel as localizedTopicLabel } from "@/lib/lobster-taxonomy";
import { getDisplayAuthor, getDisplayLobsterName, getDisplaySummary } from "@/lib/lobster-display";
import { LobsterSummary } from "@/lib/types";

function categoryLabel(value: LobsterSummary["category"]) {
  return value ? localizedCategoryLabel(value, "en") : null;
}

function topicLabel(value: NonNullable<LobsterSummary["topics"]>[number]) {
  return localizedTopicLabel(value, "en");
}

export function LobsterCard({
  item,
  locale = "en",
  variant = "default",
}: {
  item: LobsterSummary;
  locale?: Locale;
  variant?: "default" | "home";
}) {
  const t = getTranslations(locale);
  const displayName = getDisplayLobsterName(item, item.latest_source_repo);
  const author = getDisplayAuthor(item, item.latest_source_repo);
  const summary = getDisplaySummary(item, item.latest_source_repo);
  const isHomeCard = variant === "home";
  const cardClassName = ["card", "lobster-card", isHomeCard ? "lobster-card-home" : ""].filter(Boolean).join(" ");
  const category = categoryLabel(item.category);
  const homeAuthorLabel = `@${item.owner_handle}`;
  return (
    <article className={cardClassName}>
      {item.recommended && !isHomeCard ? (
        <div className="lobster-card-ribbon" aria-label={t.card.recommended}>
          <span>{t.card.recommended}</span>
        </div>
      ) : null}
      {isHomeCard ? (
        <>
          <div className="lobster-card-header lobster-card-home-header">
            <LobsterAvatar iconUrl={item.icon_url} alt="" size={52} className="lobster-card-avatar lobster-card-home-avatar" />
            <div className="lobster-card-heading">
              <h3 className="lobster-card-title lobster-card-home-title">
                <Link href={`/lobsters/${item.slug}`}>{displayName}</Link>
              </h3>
            </div>
          </div>
          <div className="lobster-card-meta lobster-card-home-meta">
            {category && item.category ? (
              <Link className="tag tag-category" href={`/categories/${item.category}`}>
                {category}
              </Link>
            ) : null}
            {item.topics?.slice(0, 2).map((topic) => (
              <Link key={topic} className="tag tag-topic" href={`/topics/${topic}`}>
                {topicLabel(topic)}
              </Link>
            ))}
          </div>
          <p className="lobster-card-summary lobster-card-home-summary">{summary}</p>
          <div className="lobster-card-footer lobster-card-home-footer">
            <span className="lobster-card-home-author">
              {author.href ? (
                <Link className="inline-link" href={author.href}>
                  {homeAuthorLabel}
                </Link>
              ) : (
                homeAuthorLabel
              )}
            </span>
            <span className="stat-chip" aria-label={`${item.view_count} views`}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M2.8 10s2.5-4.6 7.2-4.6 7.2 4.6 7.2 4.6-2.5 4.6-7.2 4.6S2.8 10 2.8 10Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="10" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <span>{item.view_count}</span>
            </span>
            <span className="stat-chip" aria-label={`${item.download_count} downloads`}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 3.2v8.1M6.8 8.9 10 12.1l3.2-3.2M4 15.2h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{item.download_count}</span>
            </span>
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
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="lobster-card-main">
              <div className="lobster-card-meta">
                {category ? <span className="tag tag-category">{category}</span> : null}
                {item.verified ? <span className="tag tag-verified">{t.detail.verified}</span> : null}
              </div>
              <div className="lobster-card-header">
                <LobsterAvatar iconUrl={item.icon_url} alt="" size={56} className="lobster-card-avatar" />
                <div className="lobster-card-heading">
                  <h3 className="lobster-card-title">
                    <Link href={`/lobsters/${item.slug}`}>{displayName}</Link>
                  </h3>
                  <p className="muted text-sm">
                    {t.card.by}{" "}
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
              </div>
            </div>
            <div className="lobster-card-side">
              <div className="mono">{item.latest_version ? `v${item.latest_version}` : t.card.noVersion}</div>
              <div>{item.license}</div>
            </div>
          </div>
          <p className="lobster-card-summary lobster-card-summary-clamped">{summary}</p>
          {item.curation_note ? <p className="lobster-card-note">{item.curation_note}</p> : null}
          {item.topics?.length ? (
            <div className="lobster-card-topics">
              {item.topics.map((topic) => (
                <Link key={topic} className="tag tag-topic" href={`/topics/${topic}`}>
                  {topicLabel(topic)}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="lobster-card-tags">
            {item.tags.map((tag) => (
              <Link key={tag} className="tag" href={`/?tag=${encodeURIComponent(tag)}`}>
                #{tag}
              </Link>
            ))}
          </div>
          <div className="lobster-card-footer">
            <span className="stat-chip" aria-label={`${item.view_count} views`}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M2.8 10s2.5-4.6 7.2-4.6 7.2 4.6 7.2 4.6-2.5 4.6-7.2 4.6S2.8 10 2.8 10Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="10" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <span>{item.view_count}</span>
            </span>
            <span className="stat-chip" aria-label={`${item.download_count} downloads`}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 3.2v8.1M6.8 8.9 10 12.1l3.2-3.2M4 15.2h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{item.download_count}</span>
            </span>
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
        </>
      )}
    </article>
  );
}
