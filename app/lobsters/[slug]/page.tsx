import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { LobsterActions } from "@/components/lobster-actions";
import { LobsterCard } from "@/components/lobster-card";
import { getLobsterAvatarSrc, LobsterAvatar } from "@/components/lobster-avatar";
import { MarkdownContent } from "@/components/markdown-content";
import { DownloadLink } from "@/components/download-link";
import { ExploreLinks } from "@/components/explore-links";
import { WorkspaceBrowser } from "@/components/workspace-browser";
import { getTranslations, type Locale } from "@/lib/i18n";
import { categoryLabel } from "@/lib/lobster-taxonomy";
import { localizePath } from "@/lib/locale-routing";
import { getRequestLocale } from "@/lib/server/locale";
import { getDetailDisplayLobsterName, getDisplayAuthor } from "@/lib/lobster-display";
import { ApiError } from "@/lib/server/errors";
import { getComments, getLobsterBySlug, getRelatedLobsters } from "@/lib/server/service";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const revalidate = 60;

function stripReadmeNoise(markdown: string) {
  const sectionsToDrop = ["Sponsors", "Community"];
  let next = markdown;

  for (const title of sectionsToDrop) {
    const pattern = new RegExp(
      String.raw`(^|\n)##\s+${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s*\n[\s\S]*?(?=\n##\s+|\n#\s+|$)`,
      "i",
    );
    next = next.replace(pattern, "\n");
  }

  return next.replace(/\n{3,}/g, "\n\n").trim();
}

function categorySeoNoun(category: string | null | undefined) {
  switch (category) {
    case "skill":
      return "OpenClaw Skill";
    case "agent":
      return "OpenClaw Agent";
    case "workflow":
      return "OpenClaw Workflow";
    case "memory":
      return "OpenClaw Memory Setup";
    case "tooling":
      return "OpenClaw Tooling";
    case "workspace":
    default:
      return "OpenClaw Setup";
  }
}

function detailSeoTitle(name: string, category: string | null | undefined) {
  return `${name} - ${categorySeoNoun(category)}`;
}

const getCachedLobster = cache(async (slug: string) => getLobsterBySlug(slug));

function topicLabel(value: string, locale: Locale) {
  if (locale === "zh") {
    switch (value) {
      case "dev":
        return "开发";
      case "design":
        return "设计";
      case "research":
        return "研究";
      case "writing":
        return "写作";
      case "productivity":
        return "效率";
      case "multiagent":
        return "多智能体";
      case "automation":
        return "自动化";
      default:
        return value;
    }
  }

  if (locale === "ja") {
    switch (value) {
      case "dev":
        return "開発";
      case "design":
        return "デザイン";
      case "research":
        return "リサーチ";
      case "writing":
        return "執筆";
      case "productivity":
        return "生産性";
      case "multiagent":
        return "マルチエージェント";
      case "automation":
        return "自動化";
      default:
        return value;
    }
  }

  switch (value) {
    case "dev":
      return "Dev";
    case "design":
      return "Design";
    case "research":
      return "Research";
    case "writing":
      return "Writing";
    case "productivity":
      return "Productivity";
    case "multiagent":
      return "Multi-Agent";
    case "automation":
      return "Automation";
    default:
      return value;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const lobster = await getCachedLobster(slug);
    const displayName = getDetailDisplayLobsterName(lobster);
    const seoTitle = detailSeoTitle(displayName, lobster.category);
    return {
      title: seoTitle,
      description: lobster.summary,
      alternates: {
        canonical: absoluteUrl(`/lobsters/${slug}`),
      },
      other: {
        "twitter:image:alt": `${displayName} preview card`,
      },
      openGraph: {
        title: seoTitle,
        description: lobster.summary,
        url: absoluteUrl(`/lobsters/${slug}`),
        type: "article",
        images: [
          {
            url: absoluteUrl(`/lobsters/${slug}/opengraph-image`),
            width: 1200,
            height: 630,
            alt: `${displayName} preview card`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: seoTitle,
        description: lobster.summary,
        site: siteConfig.xHandle,
        images: [absoluteUrl(`/lobsters/${slug}/opengraph-image`)],
      },
    };
  } catch {
    return {
      title: "Workspace",
      alternates: {
        canonical: absoluteUrl(`/lobsters/${slug}`),
      },
    };
  }
}

export default async function LobsterDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const localePromise = getRequestLocale();
  let lobster;
  try {
    lobster = await getLobsterBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  const commentsPromise = getComments(slug);
  const relatedPromise = getRelatedLobsters(slug, 6, lobster);
  const [comments, related, locale] = await Promise.all([commentsPromise, relatedPromise, localePromise]);
  const latest = lobster.versions[0];
  const topics = lobster.topics ?? [];
  const tags = lobster.tags ?? [];
  const t = getTranslations(locale);
  const displayName = getDetailDisplayLobsterName(lobster);
  const author = getDisplayAuthor(lobster, latest?.source_repo);
  return (
    <div className="page-shell stack-lg">
      <section className="shell page-panel detail-hero">
        <div className="detail-hero-main">
          <div className="detail-kickers">
            {lobster.verified ? <span className="tag tag-verified">{t.detail.verified}</span> : null}
          </div>
          <div className="detail-head">
            <LobsterAvatar iconUrl={lobster.icon_url} alt={`${displayName} icon`} size={112} className="detail-lobster-avatar" />
            <div>
              <h1 className="page-title">
                {displayName}
              </h1>
              <p className="page-subtitle">
                {t.detail.by}{" "}
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
          <p className="detail-summary">{lobster.summary}</p>
          {lobster.category ? (
            <div className="detail-topic-row">
              <Link className="tag tag-category" href={localizePath(`/categories/${lobster.category}`, locale)}>
                {categoryLabel(lobster.category, locale)}
              </Link>
            </div>
          ) : null}
          {lobster.topics?.length ? (
            <div className="detail-topic-row">
              {lobster.topics.map((topic) => (
                <Link key={topic} className="tag tag-topic" href={localizePath(`/topics/${topic}`, locale)}>
                  {topicLabel(topic, locale)}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="lobster-card-tags detail-tags">
            {lobster.tags.map((tag) => (
              <Link key={tag} className="tag" href={localizePath(`/tags/${encodeURIComponent(tag)}`, locale)}>
                #{tag}
              </Link>
            ))}
          </div>
          <div className="detail-jump-links">
            <a className="detail-jump-link" href="#readme">{t.detail.readme}</a>
            <a className="detail-jump-link" href="#workspace">{t.detail.workspace}</a>
            <a className="detail-jump-link" href="#community">{t.detail.community}</a>
          </div>
        </div>
        <aside className="detail-hero-aside">
          <div className="detail-aside-card">
            <span className="detail-aside-label">{t.detail.latestRelease}</span>
            <strong className="detail-aside-value mono">{latest ? `v${latest.version}` : t.detail.noVersion}</strong>
            <div className="detail-aside-grid">
              <div>
                <span className="detail-aside-label">{t.detail.license}</span>
                <strong className="detail-aside-meta">{lobster.license}</strong>
              </div>
              <div>
                <span className="detail-aside-label">{t.detail.files}</span>
                <strong className="detail-aside-meta">{latest?.workspace_files?.length ?? 0}</strong>
              </div>
              <div>
                <span className="detail-aside-label">{t.detail.views}</span>
                <strong className="detail-aside-meta">{lobster.view_count}</strong>
              </div>
              <div>
                <span className="detail-aside-label">{t.detail.downloads}</span>
                <strong className="detail-aside-meta">{lobster.download_count}</strong>
              </div>
            </div>
            <div className="detail-aside-actions">
              {latest ? (
                <DownloadLink
                  className="btn btn-primary"
                  href={`/api/v1/lobsters/${encodeURIComponent(slug)}/versions/${encodeURIComponent(latest.version)}/download`}
                >
                  {t.detail.downloadZip}
                </DownloadLink>
              ) : null}
              {lobster.source_url ? (
                <a className="btn" href={lobster.source_url} target="_blank" rel="noreferrer">
                  {t.detail.viewOnGithub}
                </a>
              ) : null}
              <Link className="btn" href={localizePath("/guides/openclaw-config-file", locale)}>
                {t.home.configGuideCta}
              </Link>
            </div>
          </div>
        </aside>
      </section>

      <section id="readme" className="shell page-panel p-5 md:p-6">
        {latest ? (
          <MarkdownContent value={stripReadmeNoise(latest.readme_text)} />
        ) : (
          <p className="muted mt-2">{t.detail.noVersionYet}</p>
        )}
      </section>

      {latest?.workspace_files?.length ? (
        <section id="workspace" className="shell page-panel p-5 md:p-6">
          <WorkspaceBrowser
            files={latest.workspace_files}
            publishedAt={latest.created_at}
            publishClient={latest.publish_client}
            maskedSecretsCount={latest.masked_secrets_count}
            blockedFilesCount={latest.blocked_files_count}
            downloadHref={`/api/v1/lobsters/${encodeURIComponent(slug)}/versions/${encodeURIComponent(latest.version)}/download`}
          />
        </section>
      ) : null}

      <div id="community">
        <LobsterActions
          slug={slug}
          initialComments={comments}
          initialFavoriteCount={lobster.favorite_count}
          initialShareCount={lobster.share_count}
        />
      </div>

      {related.length ? (
        <section className="shell page-panel p-5 md:p-6">
          <div className="detail-section-head">
            <h2 className="panel-title">{t.detail.related}</h2>
          </div>
          <div className="grid home-lobster-grid detail-related-grid">
            {related.map((item) => (
              <LobsterCard key={item.slug} item={item} locale={locale} variant="home" />
            ))}
          </div>
        </section>
      ) : null}

      {topics.length || tags.length ? (
        <div>
          <ExploreLinks
            locale={locale}
            rows={[
              {
                label: t.detail.topics,
                items: topics.map((topic) => ({
                  key: topic,
                  href: `/topics/${encodeURIComponent(topic)}`,
                  text: topicLabel(topic, locale),
                  className: "tag tag-topic home-explore-chip",
                })),
              },
              {
                label: t.detail.tags,
                items: tags.map((tag) => ({
                  key: tag,
                  href: `/tags/${encodeURIComponent(tag)}`,
                  text: `#${tag}`,
                  className: "tag home-explore-chip",
                })),
              },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
