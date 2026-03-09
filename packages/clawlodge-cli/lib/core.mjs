import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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
const BLOCKED_DIRS = new Set([".git", ".next", "node_modules", "dist", "build", "coverage", ".idea", ".vscode", "tmp", "temp", "logs", "data"]);
const BLOCKED_FILE_NAMES = [/^\.env(\..+)?$/i, /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i];
const BLOCKED_FILE_EXTENSIONS = new Set([".pem", ".key", ".p12", ".pfx", ".db", ".sqlite", ".sqlite3", ".log"]);
const TEXT_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".json", ".jsonc", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs", ".java", ".kt", ".sh", ".zsh", ".bash", ".html", ".css", ".scss", ".sql"]);
const ALLOWED_LICENSES = new Set(["MIT", "Apache-2.0", "CC-BY-4.0", "BSD-3-Clause", "GPL-3.0-only"]);
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const MAX_FILE_BYTES = 128 * 1024;
const MAX_EXCERPT_CHARS = 1600;
const DEFAULT_ORIGIN = "https://clawlodge.com";
const CLI_VERSION = "0.1.5";
const CONFIG_PATH = path.join(os.homedir(), ".config", "clawlodge", "config.json");
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

function slugify(inputValue) {
  return inputValue.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lobster";
}

function titleCaseFromSlug(inputValue) {
  return inputValue.split(/[-_/]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = {};
  const positionals = [];
  for (let index = 0; index < rest.length; index += 1) {
    const current = rest[index];
    if (!current.startsWith("--")) {
      positionals.push(current);
      continue;
    }
    const key = current.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options, positionals };
}

function printHelp() {
  console.log(`ClawLodge CLI

Basic usage:
  clawlodge login
  clawlodge --version
  clawlodge search "memory"
  clawlodge show openclaw-config
  clawlodge get openclaw-config
  clawlodge download openclaw-config
  clawlodge favorite openclaw-config
  clawlodge comment openclaw-config --content "Useful setup"
  clawlodge report openclaw-config --reason "Contains broken publish output"
  clawlodge pack
  clawlodge publish

Commands:
  clawlodge login
    Save a PAT locally after you create it in https://clawlodge.com/settings

  clawlodge version
    Show the installed CLI version

  clawlodge whoami
    Show the user bound to the saved PAT

  clawlodge logout
    Remove the saved local PAT

  clawlodge search
    Search published workspaces

  clawlodge show
    Show one published workspace and its versions

  clawlodge get
    Alias of clawlodge show

  clawlodge download
    Download one published workspace version as a zip

  clawlodge favorite
    Favorite one published workspace

  clawlodge unfavorite
    Remove one published workspace from favorites

  clawlodge comment
    Post a comment on one published workspace

  clawlodge report
    Submit negative feedback for one published workspace

  clawlodge pack
    Pack the default OpenClaw workspace into .clawlodge/workspace-publish.json

  clawlodge publish
    Pack the default OpenClaw workspace and publish to https://clawlodge.com

  clawlodge help
    Show this help text

Advanced usage:
  clawlodge login --origin https://clawlodge.com
  clawlodge --version
  clawlodge search "openclaw" --sort new
  clawlodge show cft0808-edict
  clawlodge get cft0808-edict
  clawlodge download cft0808-edict --version 0.1.1 --out /tmp/cft0808-edict.zip
  clawlodge favorite cft0808-edict
  clawlodge unfavorite cft0808-edict
  clawlodge comment cft0808-edict --content "Helpful docs and workflows."
  clawlodge report cft0808-edict --reason "README contains broken instructions"
  clawlodge pack --name "My Workspace"
  clawlodge publish --readme /tmp/README.md
  clawlodge pack --workspace ~/my-workspace --out /tmp/workspace-publish.json
  clawlodge publish --workspace ~/my-workspace --token claw_pat_xxx
  clawlodge publish --workspace ~/my-workspace --origin https://clawlodge.com

Environment variables:
  CLAWLODGE_PAT
  CLAWLODGE_ORIGIN
`);
}

function printVersion() {
  console.log(CLI_VERSION);
}

async function resolveWorkspaceRoot(explicitWorkspace) {
  if (explicitWorkspace?.trim()) {
    return path.resolve(explicitWorkspace.trim());
  }

  const openClawHome = path.join(process.env.HOME || process.env.USERPROFILE || "~", ".openclaw");
  const preferredPath = path.join(openClawHome, "workspace");

  try {
    const stat = await fs.stat(preferredPath);
    if (stat.isDirectory()) {
      return preferredPath;
    }
  } catch {
    // fall through to workspace* discovery
  }

  try {
    const entries = await fs.readdir(openClawHome, { withFileTypes: true });
    const workspaceDirs = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && /^workspace/i.test(entry.name))
        .map(async (entry) => {
          const fullPath = path.join(openClawHome, entry.name);
          const stat = await fs.stat(fullPath);
          return { fullPath, mtimeMs: stat.mtimeMs };
        }),
    );

    workspaceDirs.sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (workspaceDirs[0]) {
      return workspaceDirs[0].fullPath;
    }
  } catch {
    // fall through to error
  }

  throw new Error(
    "No default OpenClaw workspace found under ~/.openclaw. If your workspace is in another path, run clawlodge pack --workspace /path/to/workspace or clawlodge publish --workspace /path/to/workspace.",
  );
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

async function readExplicitReadme(readmePath) {
  const resolvedPath = path.resolve(readmePath.trim());
  const content = await fs.readFile(resolvedPath, "utf8");
  return content.trim();
}

function deriveSummary(name, summary, readme, sharedCount) {
  if (summary?.trim()) return summary.trim();
  if (readme.trim() || sharedCount > 0) {
    return `${name} OpenClaw config workspace.`;
  }
  return `${name} for OpenClaw.`;
}

async function buildPayload(options) {
  const workspaceRoot = await resolveWorkspaceRoot(options.workspace);
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

  const tags = [...new Set(String(options.tags ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))];
  const explicitReadmePath = options.readme?.trim();

  let readme = "";
  if (explicitReadmePath) {
    readme = await readExplicitReadme(explicitReadmePath);
  }

  return {
    workspaceRoot,
    payload: {
      lobster_slug: options.slug?.trim() || slugify(name),
      name,
      summary: deriveSummary(name, options.summary, readme, shared.length),
      license,
      version,
      changelog: options.changelog?.trim() || "Initial workspace publish",
      tags,
      readme_markdown: readme || undefined,
      source_repo: options.source_repo?.trim() || undefined,
      source_commit: options.source_commit?.trim() || undefined,
      publish_client: `clawlodge-cli/${CLI_VERSION}`,
      workspace_files: shared,
      blocked_files: blocked,
      skills: Array.from(skills.values()),
      settings: [
        { key: "tags", value: tags },
        { key: "blocked_files", value: blocked },
        { key: "workspace_stats", value: stats },
      ],
      stats,
    },
  };
}

async function writePack(outputPath, payload) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
}

async function readConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeConfig(config) {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { encoding: "utf8", mode: 0o600 });
}

async function clearConfig() {
  await fs.rm(CONFIG_PATH, { force: true });
}

function resolveOrigin(options, config = {}) {
  return options.origin?.trim() || process.env.CLAWLODGE_ORIGIN || config.origin?.trim() || DEFAULT_ORIGIN;
}

function resolveToken(options, config = {}) {
  return options.token?.trim() || process.env.CLAWLODGE_PAT || config.token?.trim() || "";
}

async function promptForToken(origin) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(`Missing PAT. Create one at ${origin}/settings, then run clawlodge login --token claw_pat_xxx or set CLAWLODGE_PAT.`);
  }

  console.log(`Create a PAT at ${origin}/settings and paste it below.`);
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question("PAT: ")).trim();
  } finally {
    rl.close();
  }
}

async function requestJson(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.detail || `Request failed: ${response.status}`);
  }
  return body;
}

async function requestBuffer(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return {
    body: Buffer.from(await response.arrayBuffer()),
    headers: response.headers,
  };
}

async function fetchPatProfile(origin, token) {
  return requestJson(`${origin.replace(/\/$/, "")}/api/v1/me/pat`, token, { method: "GET" });
}

async function runLogin(options) {
  const config = await readConfig();
  const origin = resolveOrigin(options, config);
  const token = options.token?.trim() || process.env.CLAWLODGE_PAT || await promptForToken(origin);
  if (!token) {
    throw new Error("PAT required");
  }

  const profile = await fetchPatProfile(origin, token);
  await writeConfig({ origin, token });
  console.log(JSON.stringify({
    ok: true,
    mode: "login",
    origin,
    user: profile.user,
    active_token_prefix: profile.active_token_prefix,
    config_path: CONFIG_PATH,
  }, null, 2));
}

async function runWhoAmI(options) {
  const config = await readConfig();
  const origin = resolveOrigin(options, config);
  const token = resolveToken(options, config);
  if (!token) {
    throw new Error(`Missing PAT. Create one at ${origin}/settings, then run clawlodge login.`);
  }

  const profile = await fetchPatProfile(origin, token);
  console.log(JSON.stringify({
    ok: true,
    mode: "whoami",
    origin,
    user: profile.user,
    active_token_prefix: profile.active_token_prefix,
    active_token_last_used_at: profile.active_token_last_used_at,
  }, null, 2));
}

async function runLogout() {
  await clearConfig();
  console.log(JSON.stringify({ ok: true, mode: "logout", config_path: CONFIG_PATH }, null, 2));
}

function requirePositional(positionals, label) {
  const value = positionals[0]?.trim();
  if (!value) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

async function runSearch(options, positionals) {
  const origin = resolveOrigin(options);
  const query = options.q?.trim() || positionals.join(" ").trim();
  const search = new URLSearchParams();
  if (query) search.set("q", query);
  if (options.sort?.trim()) search.set("sort", options.sort.trim());
  if (options.tag?.trim()) search.set("tag", options.tag.trim());
  if (options.page?.trim()) search.set("page", options.page.trim());
  if (options.per_page?.trim()) search.set("per_page", options.per_page.trim());
  const url = `${origin.replace(/\/$/, "")}/api/v1/lobsters${search.toString() ? `?${search.toString()}` : ""}`;
  const result = await requestJson(url, "");
  console.log(JSON.stringify({ ok: true, mode: "search", origin, query: query || null, result }, null, 2));
}

async function runShow(options, positionals) {
  const origin = resolveOrigin(options);
  const slug = options.slug?.trim() || requirePositional(positionals, "slug");
  const url = `${origin.replace(/\/$/, "")}/api/v1/lobsters/${encodeURIComponent(slug)}`;
  const result = await requestJson(url, "");
  console.log(JSON.stringify({ ok: true, mode: "show", origin, slug, result }, null, 2));
}

async function runDownload(options, positionals) {
  const origin = resolveOrigin(options);
  const slug = options.slug?.trim() || requirePositional(positionals, "slug");
  let version = options.version?.trim() || "";
  if (!version) {
    const detail = await requestJson(`${origin.replace(/\/$/, "")}/api/v1/lobsters/${encodeURIComponent(slug)}`, "");
    version = detail.latest_version;
    if (!version) {
      throw new Error(`No published version found for ${slug}`);
    }
  }

  const url = `${origin.replace(/\/$/, "")}/api/v1/lobsters/${encodeURIComponent(slug)}/versions/${encodeURIComponent(version)}/download`;
  const { body } = await requestBuffer(url, "");
  const out = path.resolve(options.out?.trim() || `${slug}-${version}.zip`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, body);
  console.log(JSON.stringify({ ok: true, mode: "download", origin, slug, version, out, bytes: body.length }, null, 2));
}

function requireTextOption(options, positionals, key, label) {
  const direct = options[key]?.trim();
  if (direct) return direct;
  const fallback = positionals.slice(1).join(" ").trim();
  if (fallback) return fallback;
  throw new Error(`Missing ${label}`);
}

async function runFavorite(options, positionals) {
  const config = await readConfig();
  const origin = resolveOrigin(options, config);
  const token = resolveToken(options, config);
  if (!token) {
    throw new Error(`Missing PAT. Create one at ${origin}/settings, then run clawlodge login.`);
  }
  const slug = options.slug?.trim() || requirePositional(positionals, "slug");
  const result = await requestJson(`${origin.replace(/\/$/, "")}/api/v1/lobsters/${encodeURIComponent(slug)}/favorite`, token, {
    method: "POST",
  });
  console.log(JSON.stringify({ ok: true, mode: "favorite", origin, slug, result }, null, 2));
}

async function runUnfavorite(options, positionals) {
  const config = await readConfig();
  const origin = resolveOrigin(options, config);
  const token = resolveToken(options, config);
  if (!token) {
    throw new Error(`Missing PAT. Create one at ${origin}/settings, then run clawlodge login.`);
  }
  const slug = options.slug?.trim() || requirePositional(positionals, "slug");
  const result = await requestJson(`${origin.replace(/\/$/, "")}/api/v1/lobsters/${encodeURIComponent(slug)}/favorite`, token, {
    method: "DELETE",
  });
  console.log(JSON.stringify({ ok: true, mode: "unfavorite", origin, slug, result }, null, 2));
}

async function runComment(options, positionals) {
  const config = await readConfig();
  const origin = resolveOrigin(options, config);
  const token = resolveToken(options, config);
  if (!token) {
    throw new Error(`Missing PAT. Create one at ${origin}/settings, then run clawlodge login.`);
  }
  const slug = options.slug?.trim() || requirePositional(positionals, "slug");
  const content = requireTextOption(options, positionals, "content", "comment content");
  const result = await requestJson(`${origin.replace(/\/$/, "")}/api/v1/lobsters/${encodeURIComponent(slug)}/comments`, token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  console.log(JSON.stringify({ ok: true, mode: "comment", origin, slug, result }, null, 2));
}

async function runReport(options, positionals) {
  const config = await readConfig();
  const origin = resolveOrigin(options, config);
  const token = resolveToken(options, config);
  if (!token) {
    throw new Error(`Missing PAT. Create one at ${origin}/settings, then run clawlodge login.`);
  }
  const slug = options.slug?.trim() || requirePositional(positionals, "slug");
  const reason = requireTextOption(options, positionals, "reason", "report reason");
  const result = await requestJson(`${origin.replace(/\/$/, "")}/api/v1/lobsters/${encodeURIComponent(slug)}/report`, token, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  console.log(JSON.stringify({ ok: true, mode: "report", origin, slug, result }, null, 2));
}

export async function runCli(argv = process.argv.slice(2)) {
  const { command, options, positionals } = parseArgs(argv);
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "version" || command === "--version" || command === "-v") {
    printVersion();
    return;
  }

  if (command === "login") {
    await runLogin(options);
    return;
  }

  if (command === "whoami") {
    await runWhoAmI(options);
    return;
  }

  if (command === "logout") {
    await runLogout();
    return;
  }

  if (command === "search") {
    await runSearch(options, positionals);
    return;
  }

  if (command === "show" || command === "get") {
    await runShow(options, positionals);
    return;
  }

  if (command === "download") {
    await runDownload(options, positionals);
    return;
  }

  if (command === "favorite") {
    await runFavorite(options, positionals);
    return;
  }

  if (command === "unfavorite") {
    await runUnfavorite(options, positionals);
    return;
  }

  if (command === "comment") {
    await runComment(options, positionals);
    return;
  }

  if (command === "report") {
    await runReport(options, positionals);
    return;
  }

  const { workspaceRoot, payload } = await buildPayload(options);
  const out = path.resolve(options.out ?? path.join(workspaceRoot, ".clawlodge", "workspace-publish.json"));

  if (command === "pack") {
    await writePack(out, payload);
    console.log(JSON.stringify({ ok: true, mode: "pack", out, stats: payload.stats }, null, 2));
    return;
  }

  if (command !== "publish") {
    throw new Error(`Unsupported command: ${command}`);
  }

  const config = await readConfig();
  const origin = resolveOrigin(options, config);
  const token = resolveToken(options, config);
  if (!token) {
    throw new Error(`Missing PAT. Create one at ${origin}/settings, then run clawlodge login, pass --token, or set CLAWLODGE_PAT.`);
  }

  await writePack(out, payload);
  const body = await requestJson(`${origin.replace(/\/$/, "")}/api/v1/workspace/publish`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  console.log(JSON.stringify({ ok: true, mode: "publish", out, origin, result: body }, null, 2));
}
