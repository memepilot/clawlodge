"use client";

import { FormEvent, useMemo, useState } from "react";

import { addComment, addFavorite, removeFavorite, reportLobster } from "@/lib/api";
import { CommentItem } from "@/lib/types";

export function LobsterActions({ slug, initialComments }: { slug: string; initialComments: CommentItem[] }) {
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [reportReason, setReportReason] = useState("Spam or unsafe content");
  const [message, setMessage] = useState("");

  const hasComments = useMemo(() => comments.length > 0, [comments]);

  async function onToggleFavorite() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (favorited) {
        await removeFavorite(slug);
        setFavorited(false);
      } else {
        await addFavorite(slug);
        setFavorited(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setBusy(false);
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
      setMessage(error instanceof Error ? error.message : "Comment failed");
    }
  }

  async function onReportSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const result = await reportLobster(slug, reportReason);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Report failed");
    }
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="shell page-panel p-4">
        <h3 className="panel-title">Community</h3>
        <button className={`btn mt-3 ${favorited ? "btn-primary" : ""}`} onClick={onToggleFavorite}>
          {favorited ? "Unfavorite" : "Favorite"}
        </button>

        <form className="mt-4 space-y-2" onSubmit={onCommentSubmit}>
          <label className="text-sm">Comment</label>
          <textarea
            className="textarea min-h-24"
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder="Share your idea..."
          />
          <button className="btn btn-primary" type="submit">
            Post Comment
          </button>
        </form>

        <div className="mt-4 space-y-2 text-sm">
          {hasComments ? (
            comments.map((comment) => (
              <div key={comment.id} className="subcard">
                <div className="font-medium">@{comment.user_handle}</div>
                <div className="muted">{comment.content}</div>
              </div>
            ))
          ) : (
            <p className="muted">No comments yet.</p>
          )}
        </div>
      </div>

      <div className="shell page-panel p-4">
        <h3 className="panel-title">Safety</h3>
        <form className="mt-3 space-y-2" onSubmit={onReportSubmit}>
          <label className="text-sm">Report reason</label>
          <textarea
            className="textarea min-h-24"
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
          />
          <button className="btn" type="submit">
            Submit Report
          </button>
        </form>
      </div>

      {message ? <p className="text-sm text-[var(--brand)] md:col-span-2">{message}</p> : null}
    </section>
  );
}
