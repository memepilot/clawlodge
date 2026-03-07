"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiOrigin, createLobster, createVersion, getMe } from "@/lib/api";

const LICENSES = ["MIT", "Apache-2.0", "CC-BY-4.0", "BSD-3-Clause", "GPL-3.0-only"];
const TEXT_FILE_EXTENSIONS = [
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".yaml",
  ".yml",
  ".toml",
  ".env",
  ".sh",
  ".html",
  ".css",
  ".scss",
  ".sql",
];
const MAX_TEXT_BYTES = 64 * 1024;

type WorkspaceDraftFile = {
  path: string;
  size: number;
  kind: "text" | "binary";
  content_excerpt?: string | null;
};

function sanitizeWorkspacePath(input: string) {
  return input
    .replace(/^\.openclaw\/workspace[^/]*\/?/i, "workspace/")
    .replace(/^workspace\/workspace[^/]*\/?/i, "workspace/")
    .replace(/^\/Users\/[^/]+\/\.openclaw\/workspace[^/]*\/?/i, "workspace/")
    .replace(/^\/Users\/[^/]+\//i, "~/");
}

function sanitizeWorkspaceContent(input: string) {
  return input
    .replace(/\/Users\/[^/\s]+\/\.openclaw\/workspace[^/\s]*/g, "workspace")
    .replace(/\/Users\/[^/\s]+/g, "~")
    .replace(/([A-Za-z]:\\Users\\)[^\\\s]+/g, "$1user");
}

function deriveSummary(name: string, summary: string, readme: string) {
  if (summary.trim()) return summary.trim();

  const compact = readme
    .replace(/^#+\s*/gm, "")
    .replace(/`/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) {
    return `${name} for OpenClaw.`;
  }

  return compact.slice(0, 140);
}

function deriveSkillId(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "starter-skill";
}

function isTextLikeFile(file: File, path: string) {
  const lower = path.toLowerCase();
  return file.type.startsWith("text/") || TEXT_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function toWorkspaceDraft(file: File): Promise<WorkspaceDraftFile> {
  const rawPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const path = sanitizeWorkspacePath(rawPath);
  const isText = isTextLikeFile(file, path);

  if (!isText) {
    return {
      path,
      size: file.size,
      kind: "binary",
      content_excerpt: null,
    };
  }

  const raw = await file.text();
  const excerpt = sanitizeWorkspaceContent(raw.slice(0, Math.min(raw.length, MAX_TEXT_BYTES))).trim();

  return {
    path,
    size: file.size,
    kind: "text",
    content_excerpt: excerpt || null,
  };
}

export default function PublishPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceDraftFile[]>([]);
  const githubLoginUrl = `${apiOrigin}/api/v1/auth/github/start?next=${encodeURIComponent("/publish")}`;

  useEffect(() => {
    getMe()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setCheckingAuth(false));
  }, []);

  async function ingestFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const incoming = await Promise.all(Array.from(fileList).map((file) => toWorkspaceDraft(file)));
    setWorkspaceFiles((current) => {
      const merged = new Map<string, WorkspaceDraftFile>();
      [...current, ...incoming].forEach((file) => {
        merged.set(file.path, file);
      });
      return Array.from(merged.values()).sort((a, b) => a.path.localeCompare(b.path));
    });
  }

  async function onFilePick(event: ChangeEvent<HTMLInputElement>) {
    await ingestFiles(event.target.files);
    event.target.value = "";
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") || "").trim();
    const readme = String(formData.get("readme_markdown") || "").trim();
    const summary = deriveSummary(name, String(formData.get("summary") || ""), readme);
    const license = String(formData.get("license") || "MIT");
    const tags = String(formData.get("tags") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const isHireable = formData.get("is_hireable") === "on";
    const sourceRepo = String(formData.get("source_repo") || "").trim() || undefined;
    const skillId = deriveSkillId(name);

    if (!name || !readme) {
      setMessage("Name and README are required.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const created = await createLobster({
        name,
        summary,
        license,
        tags,
        is_hireable: isHireable,
      });

      await createVersion(created.slug, {
        version: "1.0.0",
        changelog: "Initial release",
        readme_markdown: readme,
        source_repo: sourceRepo,
        workspace_files: workspaceFiles,
        skills: [
          {
            id: skillId,
            name: `${name} Core Skill`,
            entry: "skills/main.py",
            path: "skills/main.py",
          },
        ],
        settings: [
          { key: "tags", value: tags },
          {
            key: "workspace_files",
            value: workspaceFiles.map((file) => ({
              path: file.path,
              size: file.size,
              kind: file.kind,
            })),
          },
        ],
      });

      router.push(`/lobsters/${created.slug}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="page-shell">
        <section className="shell page-panel publish-wrap">
          <h1 className="page-title">Publish a lobster</h1>
          <p className="page-subtitle">Checking your login status...</p>
        </section>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="page-shell">
        <section className="shell page-panel publish-wrap">
          <h1 className="page-title">Publish a lobster</h1>
          <p className="page-subtitle">Login first, then we will bounce you straight back here.</p>
          <div className="hero-actions mt-4">
            <a className="btn btn-primary" href={githubLoginUrl}>
              Login with GitHub
            </a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="publish-hero">
        <div>
          <h1 className="page-title">Publish a lobster</h1>
          <p className="page-subtitle publish-lede">
            Drop in the essentials. We will prefill the first release, starter skill metadata, and version details for you.
          </p>
        </div>
        <div className="publish-mini-note">
          <span className="publish-mini-kicker">Tiny checklist</span>
          <span>Name + README gets you live.</span>
        </div>
      </section>

      <form className="publish-layout" onSubmit={onSubmit}>
        <section className="shell page-panel publish-main">
          <div className="publish-panel-head">
            <h2 className="panel-title">Core info</h2>
            <p className="page-subtitle">Keep it light. You can refine versions and metadata later.</p>
          </div>

          <div className="form-grid">
            <label className="field-stack">
              <span className="field-label">Name</span>
              <input className="input publish-input" name="name" placeholder="Pixel dock lobster" required />
            </label>

            <label className="field-stack">
              <span className="field-label">Short pitch</span>
              <textarea
                className="textarea publish-input publish-summary"
                name="summary"
                placeholder="Optional. Leave blank and we will derive a short summary from your README."
              />
            </label>

            <div className="publish-inline-grid">
              <label className="field-stack">
                <span className="field-label">Tags</span>
                <input className="input publish-input" name="tags" placeholder="pixel, automation, research" />
              </label>

              <label className="field-stack">
                <span className="field-label">License</span>
                <select className="select publish-input" name="license" defaultValue="MIT">
                  {LICENSES.map((license) => (
                    <option key={license} value={license}>
                      {license}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field-stack">
              <span className="field-label">README</span>
              <textarea
                className="textarea publish-input publish-readme"
                name="readme_markdown"
                placeholder={"# What this lobster does\n\nDescribe the vibe, workflow, tools, and the sharp edges it handles best."}
                required
              />
            </label>
          </div>
        </section>

        <aside className="publish-side">
          <section className="shell page-panel publish-side-card">
            <div className="publish-panel-head">
              <h2 className="panel-title">Workspace drop</h2>
              <p className="page-subtitle">Share the files that make this lobster useful.</p>
            </div>

            <div className="publish-upload-box">
              <div className="publish-upload-head">
                <strong>Workspace files</strong>
                <span className="mono">
                  {workspaceFiles.length} files
                </span>
              </div>
              <p className="page-subtitle">
                Choose loose files or an entire folder. Text files will get preview snippets automatically.
              </p>
              <div className="publish-upload-actions">
                <label className="btn">
                  Choose files
                  <input className="sr-only" type="file" multiple onChange={onFilePick} />
                </label>
                <label className="btn">
                  Choose folder
                  <input
                    className="sr-only"
                    type="file"
                    multiple
                    onChange={onFilePick}
                    {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
                  />
                </label>
              </div>
            </div>

            <div className="publish-file-list">
              {workspaceFiles.length ? (
                workspaceFiles.slice(0, 8).map((file) => (
                  <div key={file.path} className="subcard publish-file-row">
                    <div className="publish-file-meta">
                      <strong className="mono publish-file-path">{file.path}</strong>
                      <span className="muted text-xs">
                        {file.kind} · {file.size} B
                      </span>
                    </div>
                    {file.content_excerpt ? (
                      <pre className="publish-file-excerpt">{file.content_excerpt}</pre>
                    ) : (
                      <p className="muted text-sm">Binary file. Preview omitted.</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="muted">No workspace files selected yet.</p>
              )}
              {workspaceFiles.length > 8 ? (
                <p className="muted text-sm">Showing 8 of {workspaceFiles.length} files. All selected files will be published.</p>
              ) : null}
            </div>
          </section>

          <section className="shell page-panel publish-side-card">
            <div className="publish-panel-head">
              <h2 className="panel-title">Release defaults</h2>
              <p className="page-subtitle">The first publish is intentionally boring.</p>
            </div>

            <div className="publish-defaults">
              <div className="subcard">
                <div className="field-label">Version</div>
                <div className="publish-static">1.0.0</div>
              </div>
              <div className="subcard">
                <div className="field-label">Changelog</div>
                <div className="publish-static">Initial release</div>
              </div>
              <div className="subcard">
                <div className="field-label">Starter skill path</div>
                <div className="publish-static mono">skills/main.py</div>
              </div>
            </div>
          </section>

          <section className="shell page-panel publish-side-card">
            <div className="publish-panel-head">
              <h2 className="panel-title">Optional extras</h2>
              <p className="page-subtitle">Only if you want them on day one.</p>
            </div>

            <div className="form-grid">
              <label className="field-stack">
                <span className="field-label">Source repo</span>
                <input className="input publish-input" name="source_repo" placeholder="https://github.com/you/project" />
              </label>

              <label className="publish-toggle">
                <input type="checkbox" name="is_hireable" />
                <span>Mark this lobster as hireable</span>
              </label>
            </div>
          </section>

          <section className="shell page-panel publish-side-card">
            <div className="publish-panel-head">
              <h2 className="panel-title">OpenClaw CLI</h2>
              <p className="page-subtitle">Publish straight from your workspace with PAT auth and automatic redaction.</p>
            </div>
            <div className="publish-defaults">
              <div className="subcard">
                <div className="field-label">Pack locally</div>
                <div className="publish-static mono">npm run openclaw:lodge:pack -- --workspace ~/my-workspace</div>
              </div>
              <div className="subcard">
                <div className="field-label">Publish to ClawLodge</div>
                <div className="publish-static mono">npm run openclaw:lodge:publish -- --workspace ~/my-workspace --origin {apiOrigin || "http://localhost:3002"}</div>
              </div>
            </div>
          </section>

          <section className="shell page-panel publish-side-card">
            <div className="publish-panel-head">
              <h2 className="panel-title">Validation</h2>
            </div>
            <div className="publish-validation">
              <p>Name is required.</p>
              <p>README is required.</p>
              <p>Everything else can be edited later.</p>
            </div>
          </section>
        </aside>

        <section className="shell page-panel publish-footer">
          <div>
            <h2 className="panel-title">Ready to ship</h2>
            <p className="page-subtitle">This creates the lobster and its first version in one go.</p>
          </div>
          <button className="btn btn-primary publish-submit" type="submit" disabled={loading}>
            {loading ? "Publishing..." : "Publish lobster"}
          </button>
        </section>
      </form>

      {message ? <p className="publish-error">{message}</p> : null}
    </div>
  );
}
