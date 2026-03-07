#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ALLOWED_ROOT_FILES = new Set(["AGENTS.md", "SOUL.md", "TOOLS.md", "README.md"]);
const ALLOWED_PREFIXES = ["skills/", "examples/", "templates/", "prompts/", ".openclaw/"];
const BLOCKED_DIRS = new Set([".git", ".next", "node_modules", "dist", "build", "coverage", ".idea", ".vscode", "tmp", "temp", "logs", "data"]);
const BLOCKED_FILE_NAMES = [/^\.env(\..+)?$/i, /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i];
const BLOCKED_FILE_EXTENSIONS = new Set([".pem", ".key", ".p12", ".pfx", ".db", ".sqlite", ".sqlite3", ".log"]);
const TEXT_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".json", ".jsonc", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs", ".java", ".kt", ".sh", ".zsh", ".bash", ".html", ".css", ".scss", ".sql"]);
const ALLOWED_LICENSES = new Set(["MIT", "Apache-2.0", "CC-BY-4.0", "BSD-3-Clause", "GPL-3.0-only"]);
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const MAX_FILE_BYTES = 128 * 1024;
const MAX_EXCERPT_CHARS = 1600;
const REDACTION_RULES = [
  [/\bsk-[A-Za-z0-9]{20,}\b/g, "[REDACTED_OPENAI_KEY]"],
  [/\bsk-or-v1-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_OPENROUTER_KEY]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]"],
  [/\bAIza[0-9A-Za-z\-_]{20,}\b/g, "[REDACTED_GEMINI_KEY]"],
  [/\b(claw_pat_[A-Za-z0-9_-]{12,})\b/g, "[REDACTED_CLAW_PAT]"],
  [/(Authorization:\s*Bearer\s+)[^\s"'`]+/gi, "$1[REDACTED_BEARER_TOKEN]"],
  [/\b(Bearer\s+)[^\s"'`]+/g, "$1[REDACTED_BEARER_TOKEN]"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]"],
  [/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[REDACTED_PHONE]"],
  [/\b(?:10\.\d{1,3}|192\.168\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3})\.\d{1,3}\b/g, "[REDACTED_PRIVATE_IP]"],
  [/https?:\/\/[A-Za-z0-9.-]*?(?:internal|corp|local)[A-Za-z0-9./:_-]*/gi, "[REDACTED_INTERNAL_URL]"],
];

function slugify(input) {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lobster";
}

function titleCaseFromSlug(input) {
  return input.split(/[-_/]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function parseArgs(argv) {
  const [command = "pack", ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const current = rest[index];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options };
}

function normalizeRelativePath(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

function isBlockedFile(relativePath) {
  const normalized = relativePath.replace(/^\.\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) return true;
  if (parts.some((part) => BLOCKED_DIRS.has(part))) return true;
  const basename = parts.at(-1) ?? "";
  if (BLOCKED_FILE_NAMES.some((pattern) => pattern.test(basename))) return true;
  return BLOCKED_FILE_EXTENSIONS.has(path.extname(basename).toLowerCase());
}

function isAllowedFile(relativePath) {
  const normalized = relativePath.replace(/^\.\/+/, "");
  if (ALLOWED_ROOT_FILES.has(normalized)) return true;
  return ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isTextFile(relativePath) {
  return TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase()) || relativePath.endsWith(".md");
}

function sanitizeContent(content) {
  let next = content;
  let maskedCount = 0;
  for (const [pattern, replacement] of REDACTION_RULES) {
    next = next.replace(pattern, () => {
      maskedCount += 1;
      return replacement;
    });
  }
  next = next.replace(/\/Users\/[^/\s]+/g, "~").replace(/([A-Za-z]:\\Users\\)[^\\\s]+/g, "$1user");
  return { content: next.trim(), maskedCount };
}

function buildExcerpt(content) {
  const compact = content.trim();
  return compact ? compact.slice(0, MAX_EXCERPT_CHARS) : null;
}

function inferSkill(relativePath, content) {
  if (!relativePath.startsWith("skills/")) return null;
  const segments = relativePath.split("/");
  const basename = segments.at(-1) ?? relativePath;
  const folder = segments[1] ?? basename.replace(/\.[^.]+$/, "");
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return {
    id: slugify(folder),
    name: heading || titleCaseFromSlug(folder),
    entry: relativePath,
    path: relativePath,
  };
}

async function collectFiles(root, currentDir, shared, blocked, skills, stats) {
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
      await collectFiles(root, absolutePath, shared, blocked, skills, stats);
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
    const record = {
      path: relativePath,
      size: fileStat.size,
      kind: "binary",
      content_excerpt: null,
      content_text: null,
      masked_count: 0,
    };

    if (!isTextFile(relativePath) || fileStat.size > MAX_FILE_BYTES) {
      shared.push(record);
      continue;
    }

    const raw = await fs.readFile(absolutePath, "utf8");
    const sanitized = sanitizeContent(raw);
    record.kind = "text";
    record.content_excerpt = buildExcerpt(sanitized.content);
    record.content_text = sanitized.content || null;
    record.masked_count = sanitized.maskedCount;
    shared.push(record);
    stats.masked_secrets_count += sanitized.maskedCount;

    const skill = inferSkill(relativePath, sanitized.content);
    if (skill && !skills.has(skill.id)) {
      skills.set(skill.id, skill);
    }
  }
}

function buildFallbackReadme(name, files) {
  return [
    `# ${name}`,
    "",
    "Published from an OpenClaw workspace via ClawLodge.",
    "",
    "## Shared files",
    "",
    ...files.map((file) => `- \`${file.path}\``),
  ].join("\n");
}

function deriveSummary(name, summary, readme, sharedCount) {
  if (summary?.trim()) return summary.trim();
  const normalized = readme.replace(/^#+\s*/gm, "").replace(/`/g, "").replace(/\[(.*?)\]\((.*?)\)/g, "$1").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 180) : `${name} workspace publish with ${sharedCount} shared files.`;
}

async function buildPayload(options) {
  const workspaceRoot = path.resolve(options.workspace ?? process.cwd());
  const name = options.name?.trim() || titleCaseFromSlug(path.basename(workspaceRoot));
  const version = options.version?.trim() || "0.1.0";
  const license = options.license?.trim() || "MIT";
  if (!ALLOWED_LICENSES.has(license)) throw new Error(`Unsupported license: ${license}`);
  if (!SEMVER_RE.test(version)) throw new Error(`Invalid version: ${version}`);

  const shared = [];
  const blocked = [];
  const skills = new Map();
  const stats = { scanned_files: 0, shared_files: 0, blocked_files_count: 0, masked_secrets_count: 0 };

  await collectFiles(workspaceRoot, workspaceRoot, shared, blocked, skills, stats);
  shared.sort((a, b) => a.path.localeCompare(b.path));
  blocked.sort((a, b) => a.localeCompare(b));

  stats.shared_files = shared.length;
  stats.blocked_files_count = blocked.length;

  const readme = shared.find((file) => file.path === "README.md")?.content_text || buildFallbackReadme(name, shared);
  const tags = [...new Set(String(options.tags ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))];

  return {
    lobster_slug: options.slug?.trim() || slugify(name),
    name,
    summary: deriveSummary(name, options.summary, readme, shared.length),
    license,
    version,
    changelog: options.changelog?.trim() || "Initial workspace publish",
    tags,
    readme_markdown: readme,
    source_repo: options.source_repo?.trim() || undefined,
    source_commit: options.source_commit?.trim() || undefined,
    publish_client: "openclaw-lodge-cli/0.1.0",
    workspace_files: shared,
    blocked_files: blocked,
    skills: Array.from(skills.values()),
    settings: [
      { key: "tags", value: tags },
      { key: "blocked_files", value: blocked },
      { key: "workspace_stats", value: stats },
    ],
    stats,
  };
}

async function writePack(outputPath, payload) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const payload = await buildPayload(options);
  const out = path.resolve(options.out ?? path.join(".clawlodge", "workspace-publish.json"));

  if (command === "pack") {
    await writePack(out, payload);
    console.log(JSON.stringify({ ok: true, mode: "pack", out, stats: payload.stats }, null, 2));
    return;
  }

  if (command !== "publish") {
    throw new Error(`Unsupported command: ${command}`);
  }

  const origin = options.origin?.trim() || process.env.CLAWLODGE_ORIGIN || "http://localhost:3002";
  const token = options.token?.trim() || process.env.CLAWLODGE_PAT;
  if (!token) {
    throw new Error("Missing PAT. Pass --token or set CLAWLODGE_PAT.");
  }

  await writePack(out, payload);
  const response = await fetch(`${origin.replace(/\/$/, "")}/api/v1/workspace/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.detail || `Publish failed: ${response.status}`);
  }

  console.log(JSON.stringify({ ok: true, mode: "publish", out, origin, result: body }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
