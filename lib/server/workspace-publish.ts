import fs from "node:fs/promises";
import path from "node:path";

import { allowedLicenses, semverRe, slugify } from "./utils";

const ALLOWED_ROOT_FILES = new Set(["AGENTS.md", "SOUL.md", "TOOLS.md", "README.md"]);
const ALLOWED_PREFIXES = [
  "skills/",
  "examples/",
  "templates/",
  "prompts/",
  "memory/",
  "workflows/",
  "devops/",
  "docs/",
  ".openclaw/",
];
const BLOCKED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".idea",
  ".vscode",
  "tmp",
  "temp",
  "logs",
  "data",
]);
const BLOCKED_FILE_NAMES = [/^\.env(\..+)?$/i, /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i];
const BLOCKED_FILE_EXTENSIONS = new Set([".pem", ".key", ".p12", ".pfx", ".db", ".sqlite", ".sqlite3", ".log"]);
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".sh",
  ".zsh",
  ".bash",
  ".html",
  ".css",
  ".scss",
  ".sql",
]);
const MAX_FILE_BYTES = 128 * 1024;
const MAX_EXCERPT_CHARS = 1600;
const MAX_BINARY_EMBED_BYTES = 8 * 1024 * 1024;

export type WorkspaceSharedFile = {
  path: string;
  size: number;
  kind: "text" | "binary";
  content_excerpt: string | null;
  content_text: string | null;
  content_base64?: string | null;
  content_type?: string | null;
  masked_count: number;
};

export type WorkspacePackStats = {
  scanned_files: number;
  shared_files: number;
  blocked_files_count: number;
  masked_secrets_count: number;
};

export type WorkspacePublishPayload = {
  lobster_slug: string;
  name: string;
  summary: string;
  license: (typeof allowedLicenses)[number];
  version: string;
  changelog: string;
  tags: string[];
  readme_markdown?: string;
  source_repo?: string;
  source_commit?: string;
  publish_client: string;
  workspace_files: WorkspaceSharedFile[];
  blocked_files: string[];
  skills: Array<{ id: string; name: string; entry: string; path: string }>;
  settings: Array<{ key: string; value: unknown }>;
  stats: WorkspacePackStats;
};

type BuildWorkspacePublishInput = {
  workspaceRoot: string;
  name?: string;
  summary?: string;
  slug?: string;
  version?: string;
  changelog?: string;
  license?: string;
  tags?: string[];
  sourceRepo?: string;
  sourceCommit?: string;
  publishClient?: string;
};

type RedactionRule = {
  pattern: RegExp;
  replacement: string;
};

const REDACTION_RULES: RedactionRule[] = [
  { pattern: /\bsk-[A-Za-z0-9]{20,}\b/g, replacement: "[REDACTED_OPENAI_KEY]" },
  { pattern: /\bsk-or-v1-[A-Za-z0-9_-]{20,}\b/g, replacement: "[REDACTED_OPENROUTER_KEY]" },
  { pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, replacement: "[REDACTED_GITHUB_TOKEN]" },
  { pattern: /\bAIza[0-9A-Za-z\-_]{20,}\b/g, replacement: "[REDACTED_GEMINI_KEY]" },
  { pattern: /\b(claw_pat_[A-Za-z0-9_-]{12,})\b/g, replacement: "[REDACTED_CLAW_PAT]" },
  { pattern: /(Authorization:\s*Bearer\s+)[^\s"'`]+/gi, replacement: "$1[REDACTED_BEARER_TOKEN]" },
  { pattern: /\b(Bearer\s+)[^\s"'`]+/g, replacement: "$1[REDACTED_BEARER_TOKEN]" },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
  { pattern: /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, replacement: "[REDACTED_PHONE]" },
  { pattern: /\b(?:10\.\d{1,3}|192\.168\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3})\.\d{1,3}\b/g, replacement: "[REDACTED_PRIVATE_IP]" },
  { pattern: /https?:\/\/[A-Za-z0-9.-]*?(?:internal|corp|local)[A-Za-z0-9./:_-]*/gi, replacement: "[REDACTED_INTERNAL_URL]" },
];

function normalizeRelativePath(root: string, absolutePath: string) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function isBlockedFile(relativePath: string) {
  const normalized = relativePath.replace(/^\.\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) return true;

  if (parts.some((part) => BLOCKED_DIRS.has(part))) {
    return true;
  }

  const basename = parts[parts.length - 1] ?? "";
  if (BLOCKED_FILE_NAMES.some((pattern) => pattern.test(basename))) {
    return true;
  }

  const ext = path.extname(basename).toLowerCase();
  return BLOCKED_FILE_EXTENSIONS.has(ext);
}

function isAllowedFile(relativePath: string) {
  const normalized = relativePath.replace(/^\.\/+/, "");
  if (ALLOWED_ROOT_FILES.has(normalized)) {
    return true;
  }
  return ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isTextFile(relativePath: string) {
  const ext = path.extname(relativePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || relativePath.endsWith(".md");
}

function inferBinaryContentType(relativePath: string) {
  const ext = path.extname(relativePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".zip") return "application/zip";
  return "application/octet-stream";
}

async function tryReadTextFile(absolutePath: string, relativePath: string, size: number) {
  if (size > MAX_FILE_BYTES) {
    return null;
  }

  if (isTextFile(relativePath)) {
    return fs.readFile(absolutePath, "utf8");
  }

  const buffer = await fs.readFile(absolutePath);
  if (buffer.includes(0)) {
    return null;
  }

  const text = buffer.toString("utf8");
  const normalized = text.replace(/\uFEFF/g, "").trim();
  if (!normalized && size > 0) {
    return null;
  }

  return text;
}

function titleCaseFromSlug(input: string) {
  return input
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveName(workspaceRoot: string, explicit?: string) {
  if (explicit?.trim()) return explicit.trim();
  return titleCaseFromSlug(path.basename(workspaceRoot));
}

function deriveSummary(name: string, explicitSummary: string | undefined, readme: string, sharedCount: number) {
  if (explicitSummary?.trim()) return explicitSummary.trim();
  if (readme.trim() || sharedCount > 0) {
    return `${name} OpenClaw config workspace.`;
  }
  return `${name} for OpenClaw.`;
}

function sanitizeContent(content: string) {
  let next = content;
  let maskedCount = 0;

  for (const rule of REDACTION_RULES) {
    next = next.replace(rule.pattern, () => {
      maskedCount += 1;
      return rule.replacement;
    });
  }

  next = next
    .replace(/\/Users\/[^/\s]+/g, "~")
    .replace(/([A-Za-z]:\\Users\\)[^\\\s]+/g, "$1user");

  return {
    content: next.trim(),
    maskedCount,
  };
}

function buildExcerpt(content: string) {
  const compact = content.trim();
  if (!compact) return null;
  return compact.slice(0, MAX_EXCERPT_CHARS);
}

function inferSkillMeta(relativePath: string, content: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!normalized.startsWith("skills/")) return null;

  const segments = normalized.split("/");
  const basename = segments[segments.length - 1] ?? normalized;
  const folder = segments[1] ?? basename.replace(/\.[^.]+$/, "");
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();

  return {
    id: slugify(folder),
    name: heading || titleCaseFromSlug(folder),
    entry: normalized,
    path: normalized,
  };
}

async function collectFiles(
  root: string,
  currentDir: string,
  shared: WorkspaceSharedFile[],
  blocked: string[],
  skillMap: Map<string, { id: string; name: string; entry: string; path: string }>,
  stats: WorkspacePackStats,
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizeRelativePath(root, absolutePath);
    if (!relativePath) continue;

    if (entry.isDirectory()) {
      if (isBlockedFile(relativePath)) {
        blocked.push(relativePath);
        continue;
      }
      await collectFiles(root, absolutePath, shared, blocked, skillMap, stats);
      continue;
    }

    stats.scanned_files += 1;

    if (isBlockedFile(relativePath)) {
      blocked.push(relativePath);
      continue;
    }
    if (!isAllowedFile(relativePath)) {
      continue;
    }

    const fileStat = await fs.stat(absolutePath);
    const baseRecord: WorkspaceSharedFile = {
      path: relativePath,
      size: fileStat.size,
      kind: "binary",
      content_excerpt: null,
      content_text: null,
      content_base64: null,
      content_type: null,
      masked_count: 0,
    };

    const raw = await tryReadTextFile(absolutePath, relativePath, fileStat.size);
    if (raw == null) {
      if (fileStat.size <= MAX_BINARY_EMBED_BYTES) {
        const binary = await fs.readFile(absolutePath);
        shared.push({
          ...baseRecord,
          content_base64: binary.toString("base64"),
          content_type: inferBinaryContentType(relativePath),
        });
        continue;
      }
      shared.push(baseRecord);
      continue;
    }
    const sanitized = sanitizeContent(raw);
    const record: WorkspaceSharedFile = {
      ...baseRecord,
      kind: "text",
      content_excerpt: buildExcerpt(sanitized.content),
      content_text: sanitized.content || null,
      masked_count: sanitized.maskedCount,
    };
    shared.push(record);
    stats.masked_secrets_count += sanitized.maskedCount;

    const skill = inferSkillMeta(relativePath, sanitized.content);
    if (skill && !skillMap.has(skill.id)) {
      skillMap.set(skill.id, skill);
    }
  }
}

function buildFallbackReadme(name: string, files: WorkspaceSharedFile[]) {
  const lines = [
    `# ${name}`,
    "",
    "Published from an OpenClaw workspace via ClawLodge.",
    "",
    "## Shared files",
    "",
    ...files.map((file) => `- \`${file.path}\``),
  ];
  return lines.join("\n");
}

export async function buildWorkspacePublishPayload(
  input: BuildWorkspacePublishInput,
): Promise<WorkspacePublishPayload> {
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const name = deriveName(workspaceRoot, input.name);
  const version = input.version?.trim() || "0.1.0";
  const changelog = input.changelog?.trim() || "Initial workspace publish";
  const license = (input.license?.trim() || "MIT") as (typeof allowedLicenses)[number];
  if (!allowedLicenses.includes(license)) {
    throw new Error(`Unsupported license: ${license}`);
  }
  if (!semverRe.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }

  const shared: WorkspaceSharedFile[] = [];
  const blocked: string[] = [];
  const skillMap = new Map<string, { id: string; name: string; entry: string; path: string }>();
  const stats: WorkspacePackStats = {
    scanned_files: 0,
    shared_files: 0,
    blocked_files_count: 0,
    masked_secrets_count: 0,
  };

  await collectFiles(workspaceRoot, workspaceRoot, shared, blocked, skillMap, stats);

  shared.sort((a, b) => a.path.localeCompare(b.path));
  blocked.sort((a, b) => a.localeCompare(b));
  stats.shared_files = shared.length;
  stats.blocked_files_count = blocked.length;

  const readmeRecord = shared.find((file) => file.path === "README.md");
  const readmeMarkdown = readmeRecord?.content_text || buildFallbackReadme(name, shared);
  const summary = deriveSummary(name, input.summary, readmeMarkdown, shared.length);
  const tags = [...new Set((input.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];

  return {
    lobster_slug: input.slug?.trim() || slugify(name),
    name,
    summary,
    license,
    version,
    changelog,
    tags,
    readme_markdown: readmeMarkdown,
    source_repo: input.sourceRepo?.trim() || undefined,
    source_commit: input.sourceCommit?.trim() || undefined,
    publish_client: input.publishClient?.trim() || "openclaw-lodge-cli/0.1.0",
    workspace_files: shared,
    blocked_files: blocked,
    skills: Array.from(skillMap.values()),
    settings: [
      { key: "tags", value: tags },
      { key: "blocked_files", value: blocked },
      { key: "workspace_stats", value: stats },
    ],
    stats,
  };
}
