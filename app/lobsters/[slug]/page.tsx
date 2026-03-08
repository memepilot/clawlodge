import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { LobsterActions } from "@/components/lobster-actions";
import { getComments, getLobsterBySlug } from "@/lib/server/service";

export default async function LobsterDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lobster = await getLobsterBySlug(slug);
  const comments = await getComments(slug);
  const latest = lobster.versions[0];

  return (
    <div className="page-shell stack-lg">
      <section className="shell page-panel p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
        <h2 className="panel-title">Versions</h2>
        <div className="mt-3 space-y-3">
          {lobster.versions.map((version) => (
            <div key={version.version} className="subcard">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="mono">v{version.version}</strong>
                <div className="flex items-center gap-3">
                  <a
                    className="inline-link text-xs"
                    href={`/api/v1/lobsters/${encodeURIComponent(slug)}/versions/${encodeURIComponent(version.version)}/download`}
                  >
                    Download .zip
                  </a>
                  <span className="muted text-xs">{new Date(version.created_at).toLocaleString()}</span>
                </div>
              </div>
              <p className="muted mt-1 text-sm">{version.changelog}</p>
              {version.skills.length ? (
                <div className="mt-2 text-xs muted">Skills: {version.skills.map((skill) => skill.name).join(", ")}</div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="panel-title">README{latest ? ` (v${latest.version})` : ""}</h2>
          {latest ? (
            <a
              className="btn"
              href={`/api/v1/lobsters/${encodeURIComponent(slug)}/versions/${encodeURIComponent(latest.version)}/download`}
            >
              Download Latest .zip
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
          <h2 className="panel-title">Workspace</h2>
          <p className="page-subtitle mt-2">
            Shared files from the published workspace.
          </p>
          <div className="muted mt-3 text-xs">
            {latest.publish_client ? `Published via ${latest.publish_client}. ` : null}
            {latest.masked_secrets_count ? `${latest.masked_secrets_count} sensitive values redacted. ` : null}
            {latest.blocked_files_count ? `${latest.blocked_files_count} blocked files excluded.` : null}
          </div>
          <div className="workspace-grid mt-4">
            {latest.workspace_files.map((file) => (
              <article key={file.path} className="subcard workspace-card">
                <div className="workspace-card-head">
                  <strong className="mono workspace-path">{file.path}</strong>
                  <span className="muted text-xs">
                    {file.kind} · {file.size} B
                  </span>
                </div>
                {file.content_excerpt ? (
                  <details className="workspace-details">
                    <summary className="workspace-summary">
                      {file.masked_count ? `${file.masked_count} redactions applied` : "Preview shared content"}
                    </summary>
                    <pre className="workspace-excerpt">{file.content_text ?? file.content_excerpt}</pre>
                  </details>
                ) : (
                  <p className="muted text-sm">Binary file preview omitted.</p>
                )}
              </article>
            ))}
          </div>
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
