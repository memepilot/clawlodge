import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { LobsterActions } from "@/components/lobster-actions";
import { WorkspaceBrowser } from "@/components/workspace-browser";
import { ApiError } from "@/lib/server/errors";
import { getComments, getLobsterBySlug } from "@/lib/server/service";

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

  return (
    <div className="page-shell stack-lg">
      <section className="shell page-panel p-5 md:p-6">
        <div className="detail-head flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">
              {lobster.name}
            </h1>
            <p className="page-subtitle">
              by <Link className="inline-link" href={`/u/${lobster.owner_handle}`}>@{lobster.owner_handle}</Link>
            </p>
          </div>
          <div className="lobster-card-side">
            <div>{lobster.license}</div>
          </div>
        </div>

        <p className="lobster-card-summary">{lobster.summary}</p>

        <div className="lobster-card-tags">
          {lobster.tags.map((tag) => (
            <Link key={tag} className="tag" href={`/?tag=${encodeURIComponent(tag)}`}>
              #{tag}
            </Link>
          ))}
        </div>
      </section>

      <section className="shell page-panel p-5 md:p-6">
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
          <article className="markdown mt-4 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {latest.readme_text}
            </ReactMarkdown>
          </article>
        ) : (
          <p className="muted mt-2">No version published yet.</p>
        )}
      </section>

      {latest?.workspace_files?.length ? (
        <section className="shell page-panel p-5 md:p-6">
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

      <LobsterActions
        slug={slug}
        initialComments={comments}
        initialFavoriteCount={lobster.favorite_count}
        initialShareCount={lobster.share_count}
      />
    </div>
  );
}
