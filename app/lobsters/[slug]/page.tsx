import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LobsterActions } from "@/components/lobster-actions";
import { getLobsterAvatarSrc, LobsterAvatar } from "@/components/lobster-avatar";
import { MarkdownContent } from "@/components/markdown-content";
import { WorkspaceBrowser } from "@/components/workspace-browser";
import { getDetailDisplayLobsterName, getDisplayAuthor } from "@/lib/lobster-display";
import { ApiError } from "@/lib/server/errors";
import { getComments, getLobsterBySlug } from "@/lib/server/service";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const lobster = await getLobsterBySlug(slug);
    const displayName = getDetailDisplayLobsterName(lobster);
    return {
      title: displayName,
      description: lobster.summary,
      alternates: {
        canonical: absoluteUrl(`/lobsters/${slug}`),
      },
      openGraph: {
        title: displayName,
        description: lobster.summary,
        url: absoluteUrl(`/lobsters/${slug}`),
        type: "article",
        images: [
          {
            url: absoluteUrl(getLobsterAvatarSrc(lobster.icon_url)),
            alt: `${displayName} lobster icon`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: displayName,
        description: lobster.summary,
        images: [absoluteUrl(getLobsterAvatarSrc(lobster.icon_url))],
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
  let lobster;
  try {
    lobster = await getLobsterBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  const comments = await getComments(slug);
  const latest = lobster.versions[0];
  const displayName = getDetailDisplayLobsterName(lobster);
  const author = getDisplayAuthor(lobster, latest?.source_repo);

  return (
    <div className="page-shell stack-lg">
      <section className="shell page-panel detail-hero">
        <div className="detail-hero-main">
          <div className="detail-kickers">
            {lobster.source_type ? <span className="tag tag-source">{lobster.source_type === "community" ? "community upload" : lobster.source_type}</span> : null}
            {lobster.verified ? <span className="tag tag-verified">verified</span> : null}
          </div>
          <div className="detail-head">
            <LobsterAvatar iconUrl={lobster.icon_url} alt="" size={112} className="detail-lobster-avatar" />
            <div>
              <h1 className="page-title">
                {displayName}
              </h1>
              <p className="page-subtitle">
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
          </div>
          <p className="detail-summary">{lobster.summary}</p>
          <div className="lobster-card-tags detail-tags">
            {lobster.tags.map((tag) => (
              <Link key={tag} className="tag" href={`/?tag=${encodeURIComponent(tag)}`}>
                #{tag}
              </Link>
            ))}
          </div>
          <div className="detail-jump-links">
            <a className="detail-jump-link" href="#readme">README</a>
            <a className="detail-jump-link" href="#workspace">Workspace</a>
            {lobster.source_url ? <a className="detail-jump-link" href="#source-repository">Source</a> : null}
            <a className="detail-jump-link" href="#community">Community</a>
          </div>
        </div>
        <aside className="detail-hero-aside">
          <div className="detail-aside-card">
            <span className="detail-aside-label">Latest release</span>
            <strong className="detail-aside-value mono">{latest ? `v${latest.version}` : "No version"}</strong>
            <div className="detail-aside-grid">
              <div>
                <span className="detail-aside-label">License</span>
                <strong className="detail-aside-meta">{lobster.license}</strong>
              </div>
              <div>
                <span className="detail-aside-label">Files</span>
                <strong className="detail-aside-meta">{latest?.workspace_files?.length ?? 0}</strong>
              </div>
              <div>
                <span className="detail-aside-label">Downloads</span>
                <strong className="detail-aside-meta">{lobster.download_count}</strong>
              </div>
              <div>
                <span className="detail-aside-label">Favorites</span>
                <strong className="detail-aside-meta">{lobster.favorite_count}</strong>
              </div>
            </div>
            <div className="detail-aside-actions">
              {latest ? (
                <a
                  className="btn btn-primary"
                  href={`/api/v1/lobsters/${encodeURIComponent(slug)}/versions/${encodeURIComponent(latest.version)}/download`}
                >
                  Download .zip
                </a>
              ) : null}
              {lobster.source_url ? (
                <a className="btn" href={lobster.source_url} target="_blank" rel="noreferrer">
                  View on GitHub
                </a>
              ) : null}
            </div>
          </div>
        </aside>
      </section>

      <section id="readme" className="shell page-panel p-5 md:p-6">
        <div className="detail-section-head flex flex-wrap items-center justify-between gap-3">
          <h2 className="panel-title">README</h2>
          {latest ? (
            <a
              className="btn"
              href={`/api/v1/lobsters/${encodeURIComponent(slug)}/versions/${encodeURIComponent(latest.version)}/download`}
            >
              Download workspace .zip
            </a>
          ) : null}
        </div>
        {latest ? (
          <MarkdownContent value={latest.readme_text} />
        ) : (
          <p className="muted mt-2">No version published yet.</p>
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

      {lobster.source_url ? (
        <section id="source-repository" className="shell page-panel p-5 md:p-6">
          <div className="stack-sm source-card">
            <h2 className="panel-title">Source Repository</h2>
            <p className="muted text-sm">
              Original GitHub repository for this workspace.
            </p>
            <div className="source-card-link">
              <a
                className="inline-link"
                href={lobster.source_url}
                target="_blank"
                rel="noreferrer"
              >
                {lobster.source_url}
              </a>
            </div>
          </div>
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
    </div>
  );
}
