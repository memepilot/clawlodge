"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiOrigin, createLobster, createVersion, getMe } from "@/lib/api";

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

function deriveSummary(name: string, readme: string, workspaceFiles: WorkspaceDraftFile[]) {
  if (readme.trim() || workspaceFiles.length) {
    return `${name} OpenClaw config workspace.`;
  }
  return `${name} for OpenClaw.`;
}

function buildReadme(name: string, readme: string, workspaceFiles: WorkspaceDraftFile[]) {
  if (readme.trim()) return readme.trim();

  const sharedFiles = workspaceFiles.slice(0, 12).map((file) => `- \`${file.path}\``);

  return [
    `# ${name}`,
    "",
    "This README was generated from the uploaded workspace files.",
    "",
    "## Shared files",
    "",
    ...(sharedFiles.length ? sharedFiles : ["- No workspace files uploaded"]),
  ].join("\n");
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
    const readme = buildReadme(name, String(formData.get("readme_markdown") || ""), workspaceFiles);
    const summary = deriveSummary(name, readme, workspaceFiles);
    const sourceRepo = String(formData.get("source_repo") || "").trim() || undefined;
    const skillId = deriveSkillId(name);

    if (!name) {
      setMessage("Name is required.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const created = await createLobster({
        name,
        summary,
        license: "MIT",
        tags: [],
      });

      await createVersion(created.slug, {
        version: "1.0.0",
        changelog: "Initial release",
        readme_markdown: readme,
        source_repo: sourceRepo,
        workspace_files: workspaceFiles.map((file) => ({
          path: file.path,
          size: file.size,
          kind: file.kind,
          content_excerpt: file.content_excerpt ?? null,
        })),
        skills: [
          {
            id: skillId,
            name: `${name} Core Skill`,
            entry: "skills/main.py",
            path: "skills/main.py",
          },
        ],
        settings: [
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
          <h1 className="page-title">Publish your setup</h1>
          <p className="page-subtitle">Checking your login status...</p>
        </section>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="page-shell">
        <section className="shell page-panel publish-wrap">
          <h1 className="page-title">Publish your setup</h1>
          <p className="page-subtitle">Login first, then we will bring you straight back here.</p>
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
          <h1 className="page-title">Publish your OpenClaw setup</h1>
          <p className="page-subtitle publish-lede">
            Drop in the essentials. We will turn them into a clean public setup page with a generated first release.
          </p>
        </div>
        <div className="publish-mini-note">
          <span className="publish-mini-kicker">Tiny checklist</span>
          <span>Name gets you live. README can be generated from your uploaded workspace files.</span>
        </div>
      </section>

      <form className="publish-layout" onSubmit={onSubmit}>
        <section className="shell page-panel publish-main">
          <div className="publish-panel-head">
            <h2 className="panel-title">Core info</h2>
            <p className="page-subtitle">Keep it light. Start with the setup basics and refine it later.</p>
          </div>

          <div className="form-grid">
            <label className="field-stack">
              <span className="field-label">Name</span>
              <input className="input publish-input" name="name" placeholder="Pixel dock lobster" required />
            </label>

            <label className="field-stack">
              <span className="field-label">README Optional</span>
              <textarea
                className="textarea publish-input publish-readme"
                name="readme_markdown"
                placeholder={"Leave blank and we will organize a README from the uploaded workspace files."}
              />
            </label>
          </div>

          <section className="publish-subpanel publish-workspace-panel">
            <div className="field-stack">
              <span className="field-label">Workspace drop</span>
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

          <div className="publish-secondary-grid">
            <section className="publish-subpanel">
              <div className="field-stack">
                <span className="field-label">Release defaults</span>
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

            <section className="publish-subpanel">
              <div className="field-stack">
                <span className="field-label">Optional extras</span>
              </div>

              <div className="form-grid">
                <label className="field-stack">
                  <span className="field-label">Source repo Optional</span>
                  <input className="input publish-input" name="source_repo" placeholder="https://github.com/you/project" />
                </label>
              </div>
            </section>
          </div>

          <section className="publish-footer publish-footer-inline">
            <div>
              <h2 className="panel-title">Ready to ship</h2>
              <p className="page-subtitle">This creates the lobster and its first version in one go.</p>
            </div>
            <button className="btn btn-primary publish-submit" type="submit" disabled={loading}>
              {loading ? "Publishing..." : "Publish lobster"}
            </button>
          </section>
        </section>

        <aside className="publish-side">
          <section className="shell page-panel publish-side-card">
            <div className="publish-panel-head">
              <h2 className="panel-title">ClawLodge CLI</h2>
              <p className="page-subtitle">Install the CLI once, then publish straight from your workspace with PAT auth and automatic redaction.</p>
            </div>
            <div className="publish-defaults">
              <div className="subcard">
                <div className="field-label">Install</div>
                <div className="publish-static mono">npm install -g clawlodge-cli</div>
              </div>
              <div className="subcard">
                <div className="field-label">Login with PAT</div>
                <div className="publish-static mono">clawlodge login</div>
              </div>
              <div className="subcard">
                <div className="field-label">Confirm account</div>
                <div className="publish-static mono">clawlodge whoami</div>
              </div>
              <div className="subcard">
                <div className="field-label">Publish to ClawLodge</div>
                <div className="publish-static mono">clawlodge publish</div>
              </div>
            </div>
            <p className="page-subtitle mt-3">Create the PAT in Settings first. You can also pass `--name` or `--readme /path/to/README.md`. If you omit README, the server generates it during publish. Need more flags? Run `clawlodge help`.</p>
          </section>

          <section className="shell page-panel publish-side-card">
            <div className="publish-panel-head">
              <h2 className="panel-title">Validation</h2>
            </div>
            <div className="publish-validation">
              <p>Name is required.</p>
              <p>README is optional.</p>
              <p>Tags and summary can be generated later.</p>
            </div>
          </section>
        </aside>
      </form>

      {message ? <p className="publish-error">{message}</p> : null}
    </div>
  );
}
