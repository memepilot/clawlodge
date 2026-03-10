"use client";

import { useEffect, useMemo, useState } from "react";

import { useLocale, useTranslations } from "@/components/locale-provider";
import type { LobsterVersion } from "@/lib/types";

type WorkspaceFile = NonNullable<LobsterVersion["workspace_files"]>[number];
type WorkspaceFilePreview = Pick<WorkspaceFile, "path" | "size" | "kind" | "content_excerpt" | "content_text" | "masked_count">;

type WorkspaceEntry =
  | { type: "dir"; name: string; path: string; count: number }
  | { type: "file"; name: string; path: string; file: WorkspaceFile };

function listWorkspaceEntries(files: WorkspaceFile[], dir: string) {
  const prefix = dir ? `${dir}/` : "";
  const directories = new Map<string, number>();
  const entries: WorkspaceEntry[] = [];

  for (const file of files) {
    if (!file.path.startsWith(prefix)) continue;
    const remainder = file.path.slice(prefix.length);
    if (!remainder) continue;
    const [head, ...rest] = remainder.split("/");
    if (!head) continue;
    if (rest.length) {
      directories.set(head, (directories.get(head) ?? 0) + 1);
      continue;
    }
    entries.push({ type: "file", name: head, path: file.path, file });
  }

  const directoryEntries: WorkspaceEntry[] = Array.from(directories.entries()).map(([name, count]) => ({
    type: "dir",
    name,
    count,
    path: dir ? `${dir}/${name}` : name,
  }));

  return [...directoryEntries, ...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function formatWorkspaceSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPublishedAt(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date).replace(",", "");
}

function findPreviewFile(files: WorkspaceFile[], currentDir: string) {
  const entries = listWorkspaceEntries(files, currentDir);
  const firstTextFile = entries.find((entry) => entry.type === "file" && entry.file.kind === "text");
  return firstTextFile?.type === "file" ? firstTextFile.file : null;
}

export function WorkspaceBrowser({
  files,
  publishedAt,
  publishClient,
  maskedSecretsCount,
  blockedFilesCount,
  downloadHref,
}: {
  files: WorkspaceFile[];
  publishedAt: string;
  publishClient?: string | null;
  maskedSecretsCount?: number;
  blockedFilesCount?: number;
  downloadHref: string;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const [currentDir, setCurrentDir] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ path: string; payload: WorkspaceFilePreview | null } | null>(null);
  const previewBaseUrl = useMemo(() => downloadHref.replace(/\/download$/, "/workspace-file"), [downloadHref]);

  const breadcrumbParts = currentDir ? currentDir.split("/") : [];
  const entries = useMemo(() => listWorkspaceEntries(files, currentDir), [files, currentDir]);
  const fallbackPreviewFile = useMemo(() => findPreviewFile(files, currentDir), [files, currentDir]);
  const selectedFile = useMemo(() => {
    const explicit = selectedPath ? files.find((file) => file.path === selectedPath) : null;
    if (explicit) {
      const prefix = currentDir ? `${currentDir}/` : "";
      if (!prefix || explicit.path.startsWith(prefix)) {
        return explicit;
      }
    }
    return fallbackPreviewFile;
  }, [currentDir, fallbackPreviewFile, files, selectedPath]);

  useEffect(() => {
    if (!selectedFile || selectedFile.kind !== "text") {
      return;
    }

    let cancelled = false;
    fetch(`${previewBaseUrl}?path=${encodeURIComponent(selectedFile.path)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`preview ${response.status}`);
        }
        return response.json() as Promise<WorkspaceFilePreview>;
      })
      .then((payload) => {
        if (!cancelled) {
          setPreview({ path: selectedFile.path, payload });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({ path: selectedFile.path, payload: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [previewBaseUrl, selectedFile]);

  return (
    <>
      <div className="workspace-browser-head">
        <div className="workspace-browser-copy">
          <h2 className="panel-title">{t.workspace.title}</h2>
          <p className="page-subtitle mt-2">{t.workspace.snapshotHint}</p>
        </div>
        <div className="workspace-browser-aside">
          <a className="btn" href={downloadHref}>
            {t.workspace.downloadZip}
          </a>
          <div className="workspace-browser-meta">
            <span className="workspace-meta-pill">{files.length} {t.detail.files}</span>
            <span className="workspace-meta-pill">{t.workspace.updated} {formatPublishedAt(publishedAt, locale)} UTC</span>
            {maskedSecretsCount ? <span className="workspace-meta-pill">{maskedSecretsCount} {t.workspace.redactions}</span> : null}
            {blockedFilesCount ? <span className="workspace-meta-pill">{blockedFilesCount} {t.workspace.blocked}</span> : null}
          </div>
        </div>
      </div>

      <div className="workspace-browser mt-4">
        <div className="workspace-browser-toolbar">
          <div className="workspace-breadcrumbs">
            <button type="button" className="workspace-crumb workspace-crumb-button" onClick={() => setCurrentDir("")}>
              {t.workspace.root}
            </button>
            {breadcrumbParts.map((part, index) => {
              const joined = breadcrumbParts.slice(0, index + 1).join("/");
              return (
                <button
                  key={joined}
                  type="button"
                  className="workspace-crumb workspace-crumb-button"
                  onClick={() => setCurrentDir(joined)}
                >
                  {part}
                </button>
              );
            })}
          </div>
          {publishClient ? <span className="workspace-toolbar-note">{t.workspace.publishedVia} {publishClient}</span> : null}
        </div>

        <div className="workspace-table">
          {currentDir ? (
            <button
              type="button"
              className="workspace-row workspace-row-back"
              onClick={() => setCurrentDir(breadcrumbParts.slice(0, -1).join("/"))}
            >
                <span className="workspace-namecell">
                  <span className="workspace-icon">..</span>
                  <span>{t.workspace.parentDirectory}</span>
                </span>
              <span className="workspace-row-meta muted text-xs">{t.workspace.up}</span>
            </button>
          ) : null}

          {entries.map((entry) =>
            entry.type === "dir" ? (
              <button
                key={entry.path}
                type="button"
                className="workspace-row"
                onClick={() => setCurrentDir(entry.path)}
              >
                <span className="workspace-namecell">
                  <span className="workspace-icon workspace-icon-dir" />
                  <span>{entry.name}</span>
                </span>
                <span className="workspace-row-meta muted text-xs">{entry.count} {t.workspace.items}</span>
              </button>
            ) : (
              <button
                key={entry.path}
                type="button"
                className={`workspace-row ${selectedFile?.path === entry.path ? "workspace-row-active" : ""}`}
                onClick={() => setSelectedPath(entry.path)}
              >
                <span className="workspace-namecell">
                  <span className="workspace-icon workspace-icon-file" />
                  <span>{entry.name}</span>
                </span>
                <span className="workspace-row-meta muted text-xs">{formatWorkspaceSize(entry.file.size)}</span>
              </button>
            ),
          )}
        </div>

        <div id="workspace-preview" className="workspace-preview">
          <div className="workspace-preview-head">
            <strong className="mono workspace-path">{selectedFile?.path ?? t.workspace.noPreview}</strong>
            {selectedFile ? (
              <span className="muted text-xs">
                {selectedFile.kind} · {formatWorkspaceSize(selectedFile.size)}
              </span>
            ) : null}
          </div>
          {selectedFile ? (
            selectedFile.kind === "text" ? (
              <pre className="workspace-excerpt">
                {preview?.path === selectedFile.path
                  ? preview.payload?.content_text ?? preview.payload?.content_excerpt ?? ""
                  : ""}
              </pre>
            ) : (
              <p className="muted text-sm">{t.workspace.binaryOmitted}</p>
            )
          ) : (
            <p className="muted text-sm">{t.workspace.selectFile}</p>
          )}
        </div>
      </div>
    </>
  );
}
