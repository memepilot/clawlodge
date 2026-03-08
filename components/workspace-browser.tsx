"use client";

import { useMemo, useState } from "react";

import type { LobsterVersion } from "@/lib/types";

type WorkspaceFile = NonNullable<LobsterVersion["workspace_files"]>[number];

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

function formatPublishedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
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
  const [currentDir, setCurrentDir] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const breadcrumbParts = currentDir ? currentDir.split("/") : [];
  const entries = useMemo(() => listWorkspaceEntries(files, currentDir), [files, currentDir]);
  const previewFile = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? findPreviewFile(files, currentDir),
    [files, currentDir, selectedPath],
  );

  return (
    <>
      <div className="workspace-browser-head">
        <div className="workspace-browser-copy">
          <h2 className="panel-title">Workspace</h2>
          <p className="page-subtitle mt-2">Current published snapshot. New publishes overwrite this view.</p>
        </div>
        <div className="workspace-browser-aside">
          <a className="btn" href={downloadHref}>
            Download .zip
          </a>
          <div className="workspace-browser-meta">
            <span className="workspace-meta-pill">{files.length} files</span>
            <span className="workspace-meta-pill">Updated {formatPublishedAt(publishedAt)} UTC</span>
            {maskedSecretsCount ? <span className="workspace-meta-pill">{maskedSecretsCount} redactions</span> : null}
            {blockedFilesCount ? <span className="workspace-meta-pill">{blockedFilesCount} blocked</span> : null}
          </div>
        </div>
      </div>

      <div className="workspace-browser mt-4">
        <div className="workspace-browser-toolbar">
          <div className="workspace-breadcrumbs">
            <button type="button" className="workspace-crumb workspace-crumb-button" onClick={() => setCurrentDir("")}>
              root
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
          {publishClient ? <span className="workspace-toolbar-note">Published via {publishClient}</span> : null}
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
                <span>Parent directory</span>
              </span>
              <span className="workspace-row-meta muted text-xs">Up</span>
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
                <span className="workspace-row-meta muted text-xs">{entry.count} items</span>
              </button>
            ) : (
              <button
                key={entry.path}
                type="button"
                className={`workspace-row ${previewFile?.path === entry.path ? "workspace-row-active" : ""}`}
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
            <strong className="mono workspace-path">{previewFile?.path ?? "No preview selected"}</strong>
            {previewFile ? (
              <span className="muted text-xs">
                {previewFile.kind} · {formatWorkspaceSize(previewFile.size)}
              </span>
            ) : null}
          </div>
          {previewFile ? (
            previewFile.kind === "text" ? (
              <pre className="workspace-excerpt">{previewFile.content_text ?? previewFile.content_excerpt ?? ""}</pre>
            ) : (
              <p className="muted text-sm">Binary file preview omitted.</p>
            )
          ) : (
            <p className="muted text-sm">Select a file from the tree to preview its shared content.</p>
          )}
        </div>
      </div>
    </>
  );
}
