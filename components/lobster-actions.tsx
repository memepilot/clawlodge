"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { addComment, addFavorite, addShare, apiOrigin, removeFavorite, reportLobster } from "@/lib/api";
import { CommentItem } from "@/lib/types";

function formatCommentTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function LobsterActions({
  slug,
  initialComments,
  initialFavoriteCount,
  initialShareCount = 0,
}: {
  slug: string;
  initialComments: CommentItem[];
  initialFavoriteCount: number;
  initialShareCount?: number;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations();
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [favoriteCount, setFavoriteCount] = useState(initialFavoriteCount);
  const [shareCount, setShareCount] = useState(initialShareCount);
  const [message, setMessage] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);

  const hasComments = useMemo(() => comments.length > 0, [comments]);
  const nextPath = pathname || `/lobsters/${slug}`;
  const githubLoginUrl = `${apiOrigin}/api/v1/auth/github/start?next=${encodeURIComponent(nextPath)}`;

  async function onToggleFavorite() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (favorited) {
        await removeFavorite(slug);
        setFavorited(false);
        setFavoriteCount((prev) => Math.max(0, prev - 1));
      } else {
        await addFavorite(slug);
        setFavorited(true);
        setFavoriteCount((prev) => prev + 1);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t.community.operationFailed;
      if (errorMessage.includes("Authentication required")) {
        setShowLoginModal(true);
        return;
      }
      setMessage(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function onShare() {
    const shareUrl = typeof window === "undefined" ? nextPath : window.location.href;
    setMessage("");
    try {
      if (navigator.share) {
        await navigator.share({ url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setMessage(t.community.linkCopied);
      }
      const result = await addShare(slug);
      setShareCount(result.share_count);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "";
      if (messageText !== "Share canceled") {
        setMessage(t.community.shareFailed);
      }
    }
  }

  async function onCommentSubmit(event: FormEvent) {
    event.preventDefault();
    if (!commentDraft.trim()) return;
    setMessage("");
    try {
      const created = await addComment(slug, commentDraft.trim());
      setComments((prev) => [...prev, created]);
      setCommentDraft("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t.community.commentFailed;
      if (errorMessage.includes("Authentication required")) {
        setShowLoginModal(true);
        return;
      }
      setMessage(errorMessage);
    }
  }

  async function onReport() {
    setMessage("");
    try {
      const result = await reportLobster(slug, "Spam or unsafe content");
      setMessage(result.message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t.community.reportFailed;
      if (errorMessage.includes("Authentication required")) {
        setShowLoginModal(true);
        return;
      }
      setMessage(errorMessage);
    }
  }

  return (
    <>
      <section className="shell page-panel p-4 md:p-5">
        <div className="community-header">
          <h3 className="panel-title">{t.community.title}</h3>
          <div className="community-actions">
            <button
              className={`icon-action ${favorited ? "is-active" : ""}`}
              type="button"
              onClick={onToggleFavorite}
              aria-label={favorited ? t.community.unfavorite : t.community.favorite}
              title={favorited ? t.community.unfavorite : t.community.favorite}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21 10.55 19.68C5.4 15 2 11.92 2 8.15 2 5.07 4.42 2.75 7.3 2.75c1.63 0 3.2.8 4.2 2.07 1-1.27 2.57-2.07 4.2-2.07C18.58 2.75 21 5.07 21 8.15c0 3.77-3.4 6.85-8.55 11.53z" />
              </svg>
              <span className="icon-action-count">{favoriteCount}</span>
            </button>
            <button className="icon-action" type="button" onClick={onShare} aria-label={t.community.share} title={t.community.share}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a2.6 2.6 0 0 0 0-1.39l7-4.11A2.99 2.99 0 1 0 15 5a3 3 0 0 0 .04.48l-7 4.12a3 3 0 1 0 0 4.8l7.05 4.14A3 3 0 1 0 18 16.08Z" />
              </svg>
              <span className="icon-action-count">{shareCount}</span>
            </button>
          </div>
        </div>

        <form className="mt-4 space-y-2" onSubmit={onCommentSubmit}>
          <label className="text-sm community-label">{t.community.comment}</label>
          <textarea
            className="textarea min-h-24"
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder={t.community.commentPlaceholder}
          />
          <button className="btn btn-primary" type="submit">
            {t.community.postComment}
          </button>
        </form>

        <div className="comment-list mt-5">
          {hasComments ? (
            comments.map((comment) => (
              <article key={comment.id} className="comment-row">
                <div className="comment-row-header">
                  <div className="font-medium">@{comment.user_handle}</div>
                  <time className="comment-time" dateTime={comment.created_at}>
                    {formatCommentTime(comment.created_at, locale)}
                  </time>
                </div>
                <div className="muted comment-content">{comment.content}</div>
              </article>
            ))
          ) : (
            <p className="muted">{t.community.noComments}</p>
          )}
        </div>

        <button className="report-link mt-4" type="button" onClick={onReport}>
          {t.community.report}
        </button>
        {message ? <p className="mt-3 text-sm text-[var(--brand)]">{message}</p> : null}
      </section>

      {showLoginModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowLoginModal(false)}>
          <div
            className="modal-card shell"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comment-login-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="comment-login-title" className="panel-title">
              {t.auth.loginRequired}
            </h3>
            <p className="page-subtitle">
              {t.auth.loginToComment}
            </p>
            <div className="modal-actions">
              <a className="btn btn-primary" href={githubLoginUrl}>
                {t.auth.loginWithGithub}
              </a>
              <button className="btn btn-quiet" type="button" onClick={() => setShowLoginModal(false)}>
                {t.auth.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
