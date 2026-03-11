import path from "node:path";

import { CommentItem, LobsterDetail, LobsterSummary, LobsterVersion, MeProfile, SeedRecord, UserProfile } from "@/lib/types";
import { zipSync, strToU8 } from "fflate";

import { ApiError } from "./errors";
import { enqueueIconGenerationJob, kickIconJobWorker } from "./icon-jobs";
import { generateProceduralLobsterIcon, iconExtensionForContentType } from "./lobster-icon";
import { parseAndValidateManifest } from "./manifest";
import { allowRate } from "./rate-limit";
import {
  mutateDb,
  readDb,
  readMirroredComments,
  readMirroredLobsterDetail,
  readMirroredLobsterSummaries,
  readMirroredLobsterVersion,
} from "./store";
import { getStoredObject, putObject, resolvePublicAssetUrl } from "./storage";
import { DbLobster, DbLobsterVersion, DbUser } from "./types";
import {
  allowedLicenses,
  computeHotScore,
  generatePat,
  sanitizeText,
  semverRe,
  sha256,
  slugify,
  tokenPrefix,
} from "./utils";
import type { WorkspacePublishPayload } from "./workspace-publish";

const DEFAULT_README_MODEL = process.env.CLAWLODGE_README_MODEL?.trim() || "openai/gpt-4.1";
const DEFAULT_SUMMARY_MODEL = process.env.CLAWLODGE_SUMMARY_MODEL?.trim() || DEFAULT_README_MODEL;
const MAX_README_CONTEXT_FILES = 24;
const MAX_GITHUB_README_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_SUMMARY_LENGTH = 160;

function parseGithubRepoRef(sourceRepo: string | null | undefined) {
  const raw = sourceRepo?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

async function resolveGithubDefaultBranch(owner: string, repo: string) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ClawLodge",
    },
  });
  if (!response.ok) {
    throw new ApiError(502, `Failed to resolve default branch for ${owner}/${repo}`);
  }
  const body = await response.json().catch(() => ({}));
  const branch = typeof body?.default_branch === "string" ? body.default_branch.trim() : "";
  if (!branch) {
    throw new ApiError(502, `Default branch missing for ${owner}/${repo}`);
  }
  return branch;
}

async function fetchGithubRepoSignals(sourceRepo: string | null | undefined) {
  const ref = parseGithubRepoRef(sourceRepo);
  if (!ref) return null;

  const response = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ClawLodge",
    },
  });
  if (!response.ok) return null;

  const body = await response.json().catch(() => ({}));
  return {
    defaultBranch: typeof body?.default_branch === "string" ? body.default_branch.trim() || null : null,
    stars: typeof body?.stargazers_count === "number" ? body.stargazers_count : null,
  };
}

async function fetchGithubRawWorkspaceFile(params: {
  sourceRepo?: string | null;
  sourceCommit?: string | null;
  filePath: string;
}) {
  const repo = parseGithubRepoRef(params.sourceRepo);
  if (!repo) return null;
  const ref = params.sourceCommit?.trim() || await resolveGithubDefaultBranch(repo.owner, repo.repo);
  const rawUrl = toGithubRawAssetUrl(params.filePath, repo, ref);
  if (!rawUrl) return null;

  const response = await fetch(rawUrl.downloadUrl, {
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": "ClawLodge",
    },
  });
  if (!response.ok) return null;

  const arrayBuffer = await response.arrayBuffer();
  return {
    body: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

function decodeMarkdownUrl(rawTarget: string) {
  const trimmed = rawTarget.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return {
      url: trimmed.slice(1, -1).trim(),
      wrap: "angle" as const,
    };
  }
  const match = trimmed.match(/^(\S+)(\s+["'][\s\S]*["'])?$/);
  if (!match) return null;
  return {
    url: match[1],
    suffix: match[2] ?? "",
    wrap: "plain" as const,
  };
}

function isLikelyRelativeAsset(url: string) {
  return Boolean(url) && !/^(?:[a-z]+:)?\/\//i.test(url) && !url.startsWith("#") && !url.startsWith("data:");
}

function toGithubRawAssetUrl(
  assetUrl: string,
  repo: { owner: string; repo: string },
  ref: string,
) {
  if (isLikelyRelativeAsset(assetUrl)) {
    const cleanPath = assetUrl.split("#")[0].split("?")[0];
    const normalized = path.posix.normalize(cleanPath).replace(/^(\.\.\/)+/, "").replace(/^\.?\//, "");
    if (!normalized) return null;
    return {
      downloadUrl: `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${encodeURIComponent(ref)}/${normalized
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      assetPath: normalized,
    };
  }

  try {
    const parsed = new URL(assetUrl);
    if (parsed.hostname === "raw.githubusercontent.com") {
      const parts = parsed.pathname.replace(/^\/+/, "").split("/");
      if (parts.length < 4) return null;
      const owner = parts[0];
      const repoName = parts[1];
      if (owner !== repo.owner || repoName !== repo.repo) return null;
      return {
        downloadUrl: assetUrl,
        assetPath: parts.slice(3).join("/"),
      };
    }
    if (parsed.hostname === "github.com") {
      const parts = parsed.pathname.replace(/^\/+/, "").split("/");
      if (parts.length < 5) return null;
      const [owner, repoName, mode, branch, ...rest] = parts;
      if (owner !== repo.owner || repoName !== repo.repo) return null;
      if (mode !== "blob" && mode !== "raw") return null;
      const assetPath = rest.join("/");
      return {
        downloadUrl: `https://raw.githubusercontent.com/${owner}/${repoName}/${encodeURIComponent(branch)}/${assetPath
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`,
        assetPath,
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function mirrorGithubReadmeAssets(params: {
  lobsterSlug: string;
  version: string;
  readmeMarkdown: string;
  sourceRepo?: string;
  sourceCommit?: string;
}) {
  const repo = parseGithubRepoRef(params.sourceRepo);
  if (!repo) return params.readmeMarkdown;
  const repoRef = repo;

  const ref = params.sourceCommit?.trim() || await resolveGithubDefaultBranch(repoRef.owner, repoRef.repo);
  const cache = new Map<string, string>();

  async function mirror(rawUrl: string) {
    const resolved = toGithubRawAssetUrl(rawUrl, repoRef, ref);
    if (!resolved) return null;
    if (cache.has(resolved.downloadUrl)) return cache.get(resolved.downloadUrl) ?? null;

    const response = await fetch(resolved.downloadUrl, {
      headers: { "User-Agent": "ClawLodge" },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/")) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_GITHUB_README_ASSET_BYTES) return null;

    const assetKey = `lobsters/${params.lobsterSlug}/${params.version}/readme-assets/${resolved.assetPath}`;
    const storedUrl = await putObject(assetKey, Buffer.from(arrayBuffer), contentType);
    cache.set(resolved.downloadUrl, storedUrl);
    return storedUrl;
  }

  let next = params.readmeMarkdown;
  const markdownMatches = Array.from(next.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g));
  for (const match of markdownMatches) {
    const parsed = decodeMarkdownUrl(match[2]);
    if (!parsed) continue;
    const storedUrl = await mirror(parsed.url);
    if (!storedUrl) continue;
    const replacementTarget = parsed.wrap === "angle" ? `<${storedUrl}>` : `${storedUrl}${parsed.suffix ?? ""}`;
    next = next.replace(match[0], `![${match[1]}](${replacementTarget})`);
  }

  const htmlMatches = Array.from(next.matchAll(/<img\b[^>]*\bsrc=(['"])(.*?)\1[^>]*>/gi));
  for (const match of htmlMatches) {
    const storedUrl = await mirror(match[2]);
    if (!storedUrl) continue;
    next = next.replace(match[0], match[0].replace(match[2], storedUrl));
  }

  return next;
}

function buildWorkspaceReadmePrompt(payload: WorkspacePublishPayload) {
  const files = payload.workspace_files
    .filter((file) => file.kind === "text")
    .slice(0, MAX_README_CONTEXT_FILES)
    .map((file) => {
      const excerpt = file.content_excerpt || file.content_text || "";
      return [`Path: ${file.path}`, excerpt ? `Excerpt:\n${excerpt}` : "Excerpt: (empty)"].join("\n");
    })
    .join("\n\n---\n\n");

  return [
    "Write a concise README.md for a ClawLodge workspace publish.",
    "Return Markdown only.",
    "Use a practical structure: title, summary, what is included, key files, and usage notes.",
    "Do not invent capabilities that are not supported by the provided files.",
    "If details are incomplete, describe the package conservatively.",
    "",
    `Package name: ${payload.name}`,
    `Summary: ${payload.summary}`,
    `Version: ${payload.version}`,
    `Tags: ${payload.tags.length ? payload.tags.join(", ") : "(none)"}`,
    "",
    "Workspace files and excerpts:",
    files || "(no eligible text files found)",
  ].join("\n");
}

async function generateWorkspaceReadme(payload: WorkspacePublishPayload) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiError(500, "README generation is unavailable because OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
      "X-Title": "ClawLodge",
    },
    body: JSON.stringify({
      model: DEFAULT_README_MODEL,
      messages: [
        {
          role: "system",
          content: "You write concise, accurate README.md files for software workspaces. Return Markdown only.",
        },
        {
          role: "user",
          content: buildWorkspaceReadmePrompt(payload),
        },
      ],
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, body?.error?.message || body?.detail || `README generation failed: ${response.status}`);
  }

  const readme = typeof body?.choices?.[0]?.message?.content === "string"
    ? body.choices[0].message.content.trim()
    : "";
  if (!readme) {
    throw new ApiError(502, "README generation returned an empty response");
  }
  return readme;
}

function truncateSummary(value: string, maxLength = MAX_SUMMARY_LENGTH) {
  const normalized = value
    .replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|\uFFFD/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  const chars = Array.from(normalized);
  if (chars.length <= maxLength) return normalized;
  return `${chars.slice(0, maxLength - 3).join("").trim()}...`;
}

function normalizeStoredSummary(value: string) {
  return truncateSummary(value, MAX_SUMMARY_LENGTH);
}

function sanitizeSummarySource(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/`/g, "")
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/^#+\s*/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/\*+/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSummaryFallback(name: string, readmeMarkdown: string) {
  const normalized = sanitizeSummarySource(readmeMarkdown);
  return normalized ? truncateSummary(normalized) : `${name} OpenClaw config workspace.`;
}

async function generateWorkspaceSummary(name: string, readmeMarkdown: string) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return buildSummaryFallback(name, readmeMarkdown);
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
      "X-Title": "ClawLodge",
    },
    body: JSON.stringify({
      model: DEFAULT_SUMMARY_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You write concise one-sentence summaries for OpenClaw config pages. Return plain text only. Keep it under 160 characters and do not include markdown or HTML.",
        },
        {
          role: "user",
          content: [`Package name: ${name}`, "", "README:", readmeMarkdown].join("\n"),
        },
      ],
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return buildSummaryFallback(name, readmeMarkdown);
  }

  const summary = typeof body?.choices?.[0]?.message?.content === "string"
    ? body.choices[0].message.content.replace(/\s+/g, " ").trim()
    : "";

  return summary ? truncateSummary(summary) : buildSummaryFallback(name, readmeMarkdown);
}

function toSummary(item: DbLobster, owner: DbUser): LobsterSummary {
  return {
    slug: item.slug,
    name: item.name,
    summary: normalizeStoredSummary(item.summary),
    icon_url: null,
    license: item.license,
    source_type: item.sourceType,
    source_url: item.sourceUrl,
    original_author: item.originalAuthor,
    verified: item.verified,
    curation_note: item.curationNote,
    seeded_at: item.seededAt,
    owner_handle: owner.handle,
    owner_display_name: owner.displayName,
    tags: item.tags,
    latest_version: null,
    recommended: false,
    favorite_count: item.favoriteCount,
    download_count: item.downloadCount,
    share_count: item.shareCount,
    comment_count: item.commentCount,
    hot_score: computeHotScore(item.favoriteCount, item.commentCount, new Date(item.createdAt), item.reportPenalty),
    status: item.status,
    created_at: item.createdAt,
  };
}

function toVersion(version: DbLobsterVersion, options?: { includeWorkspaceContent?: boolean }): LobsterVersion {
  const includeWorkspaceContent = options?.includeWorkspaceContent ?? true;
  return {
    version: version.version,
    changelog: version.changelog,
    readme_text: version.readmeText,
    manifest_url: resolvePublicAssetUrl(version.manifestUrl) ?? version.manifestUrl,
    readme_url: resolvePublicAssetUrl(version.readmeUrl) ?? version.readmeUrl,
    icon_url: resolvePublicAssetUrl(version.iconUrl) ?? version.iconUrl,
    icon_seed: version.iconSeed,
    icon_spec_version: version.iconSpecVersion,
    skills_bundle_url: resolvePublicAssetUrl(version.skillsBundleUrl),
    source_repo: version.sourceRepo,
    source_commit: version.sourceCommit,
    publish_client: version.publishClient,
    masked_secrets_count: version.maskedSecretsCount,
    blocked_files_count: version.blockedFilesCount,
    created_at: version.createdAt,
    workspace_files: (version.workspaceFiles ?? []).map((file) => ({
      path: file.path,
      size: file.size,
      kind: file.kind,
      content_excerpt: includeWorkspaceContent ? file.contentExcerpt : null,
      content_text: includeWorkspaceContent ? file.contentText : null,
      masked_count: file.maskedCount,
    })),
    skills: version.skills.map((skill) => ({
      skill_id: skill.skillId,
      name: skill.name,
      entry: skill.entry,
      path: skill.path,
      digest: skill.digest,
      size: skill.size,
    })),
  };
}

function attachLatestVersion(summary: LobsterSummary, versions: DbLobsterVersion[]) {
  const latest = versions.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  return {
    ...summary,
    latest_version: latest?.version ?? null,
    latest_source_repo: latest?.sourceRepo ?? null,
    icon_url: resolvePublicAssetUrl(latest?.iconUrl) ?? latest?.iconUrl ?? null,
  };
}

function rankingScore(item: DbLobster, summary: LobsterSummary) {
  const downloads = item.downloadCount ?? 0;
  const githubStars = item.githubStars ?? 0;
  const recommendation = item.recommendationScore ?? 0;
  return downloads * 100000 + githubStars * 100 + recommendation + summary.hot_score;
}

function decodeStorageKeyFromUrl(url: string | null | undefined) {
  if (!url?.startsWith("/api/v1/storage/")) return null;
  const encoded = url.slice("/api/v1/storage/".length);
  return encoded
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");
}

function normalizeWorkspaceFileStorageKey(slug: string, version: string, filePath: string) {
  return `lobsters/${slug}/${version}/workspace-files/${filePath}`;
}

function iconStorageKey(slug: string, version: string, contentType: string) {
  return `lobsters/${slug}/${version}/icon.${iconExtensionForContentType(contentType)}`;
}

export async function listLobsters(params?: { sort?: string; tag?: string; q?: string; page?: number; per_page?: number }) {
  let items = await readMirroredLobsterSummaries();
  if (params?.sort !== "new") {
    const hasPendingGithubStars = items.some(
      ({ lobster }) => lobster.status === "active" && lobster.sourceUrl && parseGithubRepoRef(lobster.sourceUrl) && lobster.githubStars == null,
    );
    if (hasPendingGithubStars) {
      await mutateDb(async (db) => {
        const pending = db.lobsters.filter(
          (item) => item.status === "active" && item.sourceUrl && parseGithubRepoRef(item.sourceUrl) && item.githubStars == null,
        );
        if (!pending.length) return;

        await Promise.all(
          pending.map(async (item) => {
            const signals = await fetchGithubRepoSignals(item.sourceUrl);
            item.githubStars = signals?.stars ?? 0;
          }),
        );
      });
      items = await readMirroredLobsterSummaries();
    }
  }

  const page = Number.isFinite(Number(params?.page))
    ? Math.max(1, Math.floor(Number(params?.page)))
    : 1;
  const perPageRaw = Number.isFinite(Number(params?.per_page))
    ? Math.floor(Number(params?.per_page))
    : 12;
  const perPage = Math.min(Math.max(perPageRaw, 1), 48);
  if (params?.tag?.trim()) {
    const tag = params.tag.trim().toLowerCase();
    items = items.filter(({ lobster }) => lobster.tags.includes(tag));
  }
  if (params?.q?.trim()) {
    const q = params.q.trim().toLowerCase();
    items = items.filter(({ lobster }) => lobster.searchDocument.toLowerCase().includes(q));
  }

  const summaries = items.map(({ lobster, owner, latestVersion, latestSourceRepo, latestIconUrl }) => ({
    item: lobster,
    summary: {
      ...toSummary(lobster, {
        id: lobster.ownerId,
        handle: owner.handle,
        displayName: owner.displayName,
        avatarUrl: null,
        bio: null,
        email: null,
        githubId: null,
        favoriteSlugs: [],
        createdAt: lobster.createdAt,
        updatedAt: lobster.updatedAt,
      }),
      latest_version: latestVersion,
      latest_source_repo: latestSourceRepo,
      icon_url: resolvePublicAssetUrl(latestIconUrl) ?? latestIconUrl ?? null,
    },
  }));

  summaries.sort((a, b) => {
    if (params?.sort === "new") return +new Date(b.summary.created_at) - +new Date(a.summary.created_at);
    const scoreDiff = rankingScore(b.item, b.summary) - rankingScore(a.item, a.summary);
    if (scoreDiff !== 0) return scoreDiff;
    if (b.summary.hot_score !== a.summary.hot_score) return b.summary.hot_score - a.summary.hot_score;
    return +new Date(b.summary.created_at) - +new Date(a.summary.created_at);
  });

  const ranked = summaries.map((entry, index) => ({
    ...entry.summary,
    recommended: params?.sort !== "new" && index < 3,
  }));
  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;

  return {
    items: ranked.slice(start, start + perPage),
    total,
    page: safePage,
    per_page: perPage,
    total_pages: totalPages,
    has_prev: safePage > 1,
    has_next: safePage < totalPages,
  };
}

export async function getLobsterBySlug(slug: string): Promise<LobsterDetail> {
  const detail = await readMirroredLobsterDetail(slug);
  if (!detail) throw new ApiError(404, "Lobster not found");

  return {
    ...attachLatestVersion(toSummary(detail.lobster, detail.owner), detail.versions),
    versions: detail.versions.map((version) => toVersion(version, { includeWorkspaceContent: false })),
  };
}

export async function getWorkspaceFilePreview(slug: string, version: string, filePath: string) {
  const found = await readMirroredLobsterVersion(slug, version);
  if (!found) throw new ApiError(404, "Version not found");

  const file = (found.version.workspaceFiles ?? []).find((item) => item.path === filePath);
  if (!file) throw new ApiError(404, "Workspace file not found");

  return {
    path: file.path,
    size: file.size,
    kind: file.kind,
    content_excerpt: file.contentExcerpt,
    content_text: file.contentText,
    masked_count: file.maskedCount,
  };
}

export async function getLobsterVersion(slug: string, version: string) {
  const found = await readMirroredLobsterVersion(slug, version, true);
  if (!found) throw new ApiError(404, "Version not found");
  return toVersion(found.version);
}

export async function recordLobsterDownload(slug: string) {
  return mutateDb((db) => {
    const lobster = db.lobsters.find((item) => item.slug === slug && item.status === "active");
    if (!lobster) throw new ApiError(404, "Lobster not found");
    lobster.downloadCount = (lobster.downloadCount ?? 0) + 1;
    return { lobster_slug: slug, download_count: lobster.downloadCount };
  });
}

export async function buildLobsterVersionZip(slug: string, version: string) {
  const found = await readMirroredLobsterVersion(slug, version, true);
  if (!found) throw new ApiError(404, "Version not found");
  const lobster = found.lobster;
  const versionRecord = found.version;

  const entries: Record<string, Uint8Array> = {};
  const root = `${lobster.slug}-${versionRecord.version}`;
  const unrecoverable: string[] = [];

  entries[`${root}/README.md`] = strToU8(versionRecord.readmeText);

  const manifest = {
    schema_version: "1.0",
    lobster_slug: lobster.slug,
    version: versionRecord.version,
    name: lobster.name,
    summary: lobster.summary,
    license: lobster.license,
    readme_path: "README.md",
    skills: versionRecord.skills.map((skill) => ({
      id: skill.skillId,
      name: skill.name,
      entry: skill.entry,
      path: skill.path,
      digest: skill.digest ?? undefined,
      size: skill.size ?? undefined,
    })),
    settings: [
      { key: "blocked_files_count", value: versionRecord.blockedFilesCount },
      { key: "masked_secrets_count", value: versionRecord.maskedSecretsCount },
    ],
    source: {
      repo_url: versionRecord.sourceRepo,
      commit: versionRecord.sourceCommit,
    },
    publish_client: versionRecord.publishClient,
  };
  entries[`${root}/manifest.json`] = strToU8(JSON.stringify(manifest, null, 2));

  for (const file of versionRecord.workspaceFiles ?? []) {
    if (file.path === "README.md") continue;
    if (file.kind === "text" && file.contentText) {
      entries[`${root}/${file.path}`] = strToU8(file.contentText);
      continue;
    }

    const storedKey = decodeStorageKeyFromUrl(file.storageUrl);
    if (storedKey) {
      const stored = await getStoredObject(storedKey);
      entries[`${root}/${file.path}`] = new Uint8Array(stored.body);
      continue;
    }

    const githubRaw = await fetchGithubRawWorkspaceFile({
      sourceRepo: versionRecord.sourceRepo,
      sourceCommit: versionRecord.sourceCommit,
      filePath: file.path,
    });
    if (githubRaw) {
      entries[`${root}/${file.path}`] = new Uint8Array(githubRaw.body);
      continue;
    }

    unrecoverable.push(file.path);
  }

  const skillsBundleKey = decodeStorageKeyFromUrl(versionRecord.skillsBundleUrl);
  if (skillsBundleKey) {
    const stored = await getStoredObject(skillsBundleKey);
    entries[`${root}/skills_bundle.zip`] = new Uint8Array(stored.body);
  }

  if (unrecoverable.length) {
    entries[`${root}/EXPORT_NOTES.md`] = strToU8([
      "# Export Notes",
      "",
      "Some published workspace files could not be reconstructed into this archive because only preview or metadata was stored for them.",
      "",
      "Missing files:",
      "",
      ...unrecoverable.map((filePath) => `- \`${filePath}\``),
    ].join("\n"));
  }

  return {
    filename: `${root}.zip`,
    body: zipSync(entries, { level: 6 }),
  };
}

export async function createLobster(
  userId: number,
  payload: {
    name: string;
    summary: string;
    license: string;
    tags: string[];
  },
) {
  if (!payload.name.trim() || !payload.summary.trim()) throw new ApiError(400, "Invalid payload");
  if (!allowedLicenses.includes(payload.license as (typeof allowedLicenses)[number])) {
    throw new ApiError(400, "Invalid license");
  }

  return mutateDb((db) => {
    const base = slugify(payload.name);
    let slug = base;
    let idx = 2;
    while (db.lobsters.some((item) => item.slug === slug)) {
      slug = `${base}-${idx++}`;
    }
    const tags = [...new Set(payload.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
    const now = new Date().toISOString();
    const lobster: DbLobster = {
      id: db.nextIds.lobster++,
      slug,
      ownerId: userId,
      name: payload.name.trim(),
      summary: payload.summary.trim(),
      license: payload.license,
      sourceType: "community",
      sourceUrl: null,
      originalAuthor: null,
      verified: false,
      curationNote: null,
      seededAt: null,
      status: "active",
      reportPenalty: 0,
      searchDocument: [payload.name.trim(), payload.summary.trim(), tags.join(" ")].join("\n"),
      tags,
      recommendationScore: null,
      githubStars: null,
      favoriteCount: 0,
      downloadCount: 0,
      shareCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    db.lobsters.push(lobster);
    const owner = db.users.find((user) => user.id === userId)!;
    return {
      ...attachLatestVersion(toSummary(lobster, owner), []),
      versions: [],
    };
  });
}

export async function createVersion(
  userId: number,
  slug: string,
  payload: {
    version: string;
    changelog: string;
    readme_markdown: string;
    icon_base64?: string;
    icon_content_type?: string;
    icon_seed?: string;
    icon_spec_version?: string;
    source_repo?: string;
    source_commit?: string;
    workspace_files?: Array<{
      path: string;
      size: number;
      kind: "text" | "binary";
      content_excerpt?: string | null;
      content_text?: string | null;
      content_base64?: string | null;
      content_type?: string | null;
      masked_count?: number;
    }>;
    publish_client?: string;
    masked_secrets_count?: number;
    blocked_files_count?: number;
    skills: Array<{ id: string; name: string; entry: string; path: string; digest?: string; size?: number }>;
    settings: Array<{ key: string; value: unknown }>;
  },
) {
  if (!semverRe.test(payload.version)) throw new ApiError(400, "Invalid version");
  if (!payload.changelog.trim() || !payload.readme_markdown.trim()) throw new ApiError(400, "Invalid payload");

  let createdId = 0;
  let shouldQueueIcon = false;
  const version = await mutateDb(async (db) => {
    const lobster = db.lobsters.find((item) => item.slug === slug);
    if (!lobster) throw new ApiError(404, "Lobster not found");
    if (lobster.ownerId !== userId) throw new ApiError(403, "Only owner can publish versions");
    if (db.lobsterVersions.some((item) => item.lobsterId === lobster.id && item.version === payload.version)) {
      throw new ApiError(409, "version already exists");
    }
    const migratedReadmeMarkdown = await mirrorGithubReadmeAssets({
      lobsterSlug: lobster.slug,
      version: payload.version,
      readmeMarkdown: payload.readme_markdown,
      sourceRepo: payload.source_repo,
      sourceCommit: payload.source_commit,
    });
    const generatedSummary = await generateWorkspaceSummary(lobster.name, migratedReadmeMarkdown);
    const repoSignals = await fetchGithubRepoSignals(payload.source_repo);

    const manifest = {
      schema_version: "1.0",
      lobster_slug: lobster.slug,
      version: payload.version,
      name: lobster.name,
      summary: generatedSummary,
      license: lobster.license,
      readme_path: "README.md",
      skills: payload.skills,
      settings: payload.settings,
      source: {
        repo_url: payload.source_repo,
        commit: payload.source_commit,
      },
    };
    const proceduralIcon = generateProceduralLobsterIcon({
      slug: lobster.slug,
      version: payload.version,
      tags: lobster.tags,
      sourceType: lobster.sourceType,
      workspacePaths: (payload.workspace_files ?? []).map((file) => file.path),
      readmeText: migratedReadmeMarkdown,
      summary: generatedSummary,
    });
    const icon = payload.icon_base64?.trim() && payload.icon_content_type?.trim()
      ? {
          body: Buffer.from(payload.icon_base64, "base64"),
          contentType: payload.icon_content_type.trim(),
          seed: payload.icon_seed?.trim() || proceduralIcon.seed,
          specVersion: payload.icon_spec_version?.trim() || "uploaded-local-v1",
        }
      : proceduralIcon;

    const readmeUrl = await putObject(
      `lobsters/${lobster.slug}/${payload.version}/README.md`,
      Buffer.from(migratedReadmeMarkdown, "utf8"),
      "text/markdown",
    );
    const manifestUrl = await putObject(
      `lobsters/${lobster.slug}/${payload.version}/manifest.json`,
      Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      "application/json",
    );
    const iconUrl = await putObject(
      iconStorageKey(lobster.slug, payload.version, icon.contentType),
      icon.body,
      icon.contentType,
    );

    const now = new Date().toISOString();
    const workspaceFiles = await Promise.all((payload.workspace_files ?? []).map(async (file) => {
      let storageUrl: string | null = null;
      let contentType: string | null = file.content_type ?? null;
      if (file.kind === "binary" && file.content_base64) {
        const body = Buffer.from(file.content_base64, "base64");
        contentType = file.content_type ?? "application/octet-stream";
        storageUrl = await putObject(
          normalizeWorkspaceFileStorageKey(lobster.slug, payload.version, file.path),
          body,
          contentType,
        );
      }
      return {
        path: file.path,
        size: file.size,
        kind: file.kind,
        contentExcerpt: file.content_excerpt ?? null,
        contentText: file.content_text ?? null,
        contentType,
        storageUrl,
        maskedCount: file.masked_count ?? 0,
      };
    }));

    const created: DbLobsterVersion = {
      id: db.nextIds.lobsterVersion++,
      lobsterId: lobster.id,
      createdBy: userId,
      version: payload.version,
      changelog: payload.changelog.trim(),
      readmeText: migratedReadmeMarkdown,
      manifestUrl,
      readmeUrl,
      skillsBundleUrl: null,
      iconUrl,
      iconSeed: icon.seed,
      iconSpecVersion: icon.specVersion,
      sourceRepo: payload.source_repo ?? null,
      sourceCommit: payload.source_commit ?? null,
      workspaceFiles,
      publishClient: payload.publish_client ?? null,
      maskedSecretsCount: payload.masked_secrets_count ?? 0,
      blockedFilesCount: payload.blocked_files_count ?? 0,
      skills: payload.skills.map((skill) => ({
        skillId: skill.id,
        name: skill.name,
        entry: skill.entry,
        path: skill.path,
        digest: skill.digest ?? null,
        size: skill.size ?? null,
      })),
      createdAt: now,
    };
    db.lobsterVersions.push(created);
    createdId = created.id;
    shouldQueueIcon = !(payload.icon_base64?.trim() && payload.icon_content_type?.trim());
    lobster.summary = generatedSummary;
    lobster.updatedAt = now;
    lobster.githubStars = repoSignals?.stars ?? lobster.githubStars ?? null;
    lobster.searchDocument = [
      lobster.name,
      generatedSummary,
      migratedReadmeMarkdown,
      lobster.tags.join(" "),
      ...(payload.workspace_files ?? []).map((file) => `${file.path}\n${file.content_excerpt ?? ""}`),
    ].join("\n");
    return toVersion(created);
  });

  if (shouldQueueIcon && createdId) {
    await enqueueIconGenerationJob(createdId);
    void kickIconJobWorker();
  }

  return version;
}

export async function getComments(slug: string): Promise<CommentItem[]> {
  const rows = await readMirroredComments(slug);
  if (!rows) throw new ApiError(404, "Lobster not found");
  return rows.map(({ comment, userHandle, userDisplayName }) => ({
    id: comment.id,
    lobster_slug: slug,
    user_handle: userHandle,
    user_display_name: userDisplayName,
    content: comment.content,
    created_at: comment.createdAt,
  }));
}

export async function addComment(userId: number, slug: string, content: string) {
  if (!(await allowRate(`comment:${userId}`, 20, 60))) throw new ApiError(429, "Too many comments");
  const clean = sanitizeText(content)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  if (!clean) throw new ApiError(400, "Invalid payload");

  return mutateDb((db) => {
    const lobster = db.lobsters.find((item) => item.slug === slug && item.status === "active");
    if (!lobster) throw new ApiError(404, "Lobster not found");
    const comment = {
      id: db.nextIds.comment++,
      userId,
      lobsterId: lobster.id,
      content: clean,
      createdAt: new Date().toISOString(),
    };
    db.comments.push(comment);
    lobster.commentCount += 1;
    const user = db.users.find((item) => item.id === userId)!;
    return {
      id: comment.id,
      lobster_slug: slug,
      user_handle: user.handle,
      user_display_name: user.displayName,
      content: comment.content,
      created_at: comment.createdAt,
    };
  });
}

export async function addFavorite(userId: number, slug: string) {
  return mutateDb((db) => {
    const lobster = db.lobsters.find((item) => item.slug === slug && item.status === "active");
    if (!lobster) throw new ApiError(404, "Lobster not found");
    const user = db.users.find((item) => item.id === userId)!;
    if (!user.favoriteSlugs.includes(slug)) {
      user.favoriteSlugs.push(slug);
      lobster.favoriteCount += 1;
    }
    return { lobster_slug: slug, favorited: true };
  });
}

export async function removeFavorite(userId: number, slug: string) {
  return mutateDb((db) => {
    const lobster = db.lobsters.find((item) => item.slug === slug);
    if (!lobster) throw new ApiError(404, "Lobster not found");
    const user = db.users.find((item) => item.id === userId)!;
    if (user.favoriteSlugs.includes(slug)) {
      user.favoriteSlugs = user.favoriteSlugs.filter((item) => item !== slug);
      lobster.favoriteCount = Math.max(0, lobster.favoriteCount - 1);
    }
    return { lobster_slug: slug, favorited: false };
  });
}

export async function addShare(slug: string) {
  return mutateDb((db) => {
    const lobster = db.lobsters.find((item) => item.slug === slug && item.status === "active");
    if (!lobster) throw new ApiError(404, "Lobster not found");
    lobster.shareCount += 1;
    return { lobster_slug: slug, share_count: lobster.shareCount };
  });
}

export async function submitReport(userId: number, slug: string, reason: string) {
  if (!(await allowRate(`report:${userId}`, 10, 24 * 3600))) throw new ApiError(429, "Too many reports");
  if (!reason.trim()) throw new ApiError(400, "Invalid payload");

  return mutateDb((db) => {
    const lobster = db.lobsters.find((item) => item.slug === slug && item.status === "active");
    if (!lobster) throw new ApiError(404, "Lobster not found");
    db.reports.push({
      id: db.nextIds.report++,
      lobsterId: lobster.id,
      reporterId: userId,
      reason: reason.trim(),
      status: "open",
      handledBy: null,
      handledAt: null,
      createdAt: new Date().toISOString(),
    });
    const openCount = db.reports.filter((item) => item.lobsterId === lobster.id && item.status === "open").length;
    if (openCount >= 3) lobster.reportPenalty = 2;
    return { message: "Report submitted" };
  });
}

export async function getUserProfile(handle: string): Promise<UserProfile> {
  const db = await readDb();
  const user = db.users.find((item) => item.handle === handle);
  if (!user) throw new ApiError(404, "User not found");

  const hire = db.hireProfiles.find((item) => item.userId === user.id) ?? null;
  const published = db.lobsters
    .filter((item) => item.ownerId === user.id && item.status === "active")
    .map((item) => attachLatestVersion(toSummary(item, user), db.lobsterVersions.filter((version) => version.lobsterId === item.id)));
  const favorites = user.favoriteSlugs
    .map((slug) => db.lobsters.find((item) => item.slug === slug && item.status === "active"))
    .filter(Boolean)
    .map((item) => attachLatestVersion(toSummary(item!, db.users.find((userItem) => userItem.id === item!.ownerId)!), db.lobsterVersions.filter((version) => version.lobsterId === item!.id)));

  return {
    user: {
      id: user.id,
      handle: user.handle,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      bio: user.bio,
    },
    hire_profile: hire
      ? {
          status: hire.status,
          contact_type: hire.contactType,
          contact_value: hire.contactValue,
          timezone: hire.timezone,
          response_sla_hours: hire.responseSlaHours,
        }
      : null,
    published,
    favorites,
  };
}

export async function getMe(userId: number): Promise<MeProfile> {
  const db = await readDb();
  const user = db.users.find((item) => item.id === userId);
  if (!user) throw new ApiError(401, "User not found");
  const hire = db.hireProfiles.find((item) => item.userId === user.id) ?? null;
  const token = db.apiTokens
    .filter((item) => item.userId === user.id && !item.revoked)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

  return {
    user: {
      id: user.id,
      handle: user.handle,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      bio: user.bio,
    },
    hire_profile: hire
      ? {
          status: hire.status,
          contact_type: hire.contactType,
          contact_value: hire.contactValue,
          timezone: hire.timezone,
          response_sla_hours: hire.responseSlaHours,
        }
      : null,
    active_token_prefix: token?.tokenPrefix ?? null,
    active_token_last_used_at: token?.lastUsedAt ?? null,
  };
}

export async function rotateToken(userId: number) {
  return mutateDb((db) => {
    const now = new Date().toISOString();
    db.apiTokens
      .filter((item) => item.userId === userId && !item.revoked)
      .forEach((item) => {
        item.revoked = true;
        item.revokedAt = now;
      });
    const token = generatePat();
    db.apiTokens.push({
      id: db.nextIds.apiToken++,
      userId,
      tokenHash: sha256(token),
      tokenPrefix: tokenPrefix(token),
      revoked: false,
      createdAt: now,
      revokedAt: null,
      lastUsedAt: null,
    });
    return {
      token,
      token_prefix: tokenPrefix(token),
      created_at: now,
    };
  });
}

export async function updateHireProfile(
  userId: number,
  payload: {
    status: "open" | "closed";
    contact_type?: string;
    contact_value?: string;
    timezone?: string;
    response_sla_hours?: number;
  },
) {
  if (!["open", "closed"].includes(payload.status)) throw new ApiError(400, "Invalid payload");

  return mutateDb((db) => {
    const now = new Date().toISOString();
    let profile = db.hireProfiles.find((item) => item.userId === userId);
    if (!profile) {
      profile = {
        id: db.nextIds.hireProfile++,
        userId,
        status: payload.status,
        contactType: payload.contact_type ?? null,
        contactValue: payload.contact_value ?? null,
        timezone: payload.timezone ?? null,
        responseSlaHours: payload.response_sla_hours ?? null,
        createdAt: now,
        updatedAt: now,
      };
      db.hireProfiles.push(profile);
    } else {
      profile.status = payload.status;
      profile.contactType = payload.contact_type ?? null;
      profile.contactValue = payload.contact_value ?? null;
      profile.timezone = payload.timezone ?? null;
      profile.responseSlaHours = payload.response_sla_hours ?? null;
      profile.updatedAt = now;
    }
    return {
      status: profile.status,
      contact_type: profile.contactType,
      contact_value: profile.contactValue,
      timezone: profile.timezone,
      response_sla_hours: profile.responseSlaHours,
    };
  });
}

function normalizeHandle(handle: string) {
  return slugify(handle).replace(/-/g, "");
}

function reserveHandle(db: { users: DbUser[] }, baseHandle: string) {
  let handle = baseHandle;
  let index = 2;
  while (db.users.some((item) => item.handle === handle)) {
    handle = `${baseHandle}${index++}`;
  }
  return handle;
}

export async function findOrCreateUserByHandle(handle: string) {
  const clean = normalizeHandle(handle);
  if (!clean || clean.length < 2) throw new ApiError(400, "Invalid handle");
  return mutateDb((db) => {
    const existing = db.users.find((item) => item.handle === clean);
    if (existing) return existing;
    const now = new Date().toISOString();
    const user = {
      id: db.nextIds.user++,
      handle: clean,
      displayName: clean,
      avatarUrl: null,
      bio: null,
      email: null,
      githubId: null,
      favoriteSlugs: [],
      createdAt: now,
      updatedAt: now,
    };
    db.users.push(user);
    return user;
  });
}

export async function findOrCreateGithubUser(profile: {
  githubId: string;
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  email?: string | null;
}) {
  const baseHandle = normalizeHandle(profile.login);
  if (!baseHandle || baseHandle.length < 2) {
    throw new ApiError(400, "Invalid GitHub profile");
  }

  return mutateDb((db) => {
    const now = new Date().toISOString();
    const byGithubId = db.users.find((item) => item.githubId === profile.githubId);
    if (byGithubId) {
      byGithubId.displayName = profile.name ?? byGithubId.displayName;
      byGithubId.avatarUrl = profile.avatarUrl ?? byGithubId.avatarUrl;
      byGithubId.bio = profile.bio ?? byGithubId.bio;
      byGithubId.email = profile.email ?? byGithubId.email;
      if (byGithubId.handle !== baseHandle && !db.users.some((item) => item.id !== byGithubId.id && item.handle === baseHandle)) {
        byGithubId.handle = baseHandle;
      }
      byGithubId.updatedAt = now;
      return byGithubId;
    }

    const byHandle = db.users.find((item) => item.handle === baseHandle);
    if (byHandle && !byHandle.githubId) {
      byHandle.githubId = profile.githubId;
      byHandle.displayName = profile.name ?? byHandle.displayName;
      byHandle.avatarUrl = profile.avatarUrl ?? byHandle.avatarUrl;
      byHandle.bio = profile.bio ?? byHandle.bio;
      byHandle.email = profile.email ?? byHandle.email;
      byHandle.updatedAt = now;
      return byHandle;
    }

    const user = {
      id: db.nextIds.user++,
      handle: reserveHandle(db, baseHandle),
      displayName: profile.name ?? profile.login,
      avatarUrl: profile.avatarUrl ?? null,
      bio: profile.bio ?? null,
      email: profile.email ?? null,
      githubId: profile.githubId,
      favoriteSlugs: [],
      createdAt: now,
      updatedAt: now,
    };
    db.users.push(user);
    return user;
  });
}

export async function uploadViaMcp(
  userId: number,
  files: { manifestRaw: Buffer; readmeRaw: Buffer; skillsRaw: Buffer },
) {
  if (!(await allowRate(`mcp:${userId}`, 30, 3600))) throw new ApiError(429, "MCP upload rate limit exceeded");
  const manifest = parseAndValidateManifest(files.manifestRaw);

  const result = await mutateDb(async (db) => {
    let lobster = db.lobsters.find((item) => item.slug === slugify(manifest.lobster_slug));
    if (!lobster) {
      const now = new Date().toISOString();
      lobster = {
        id: db.nextIds.lobster++,
        slug: slugify(manifest.lobster_slug),
        ownerId: userId,
        name: manifest.name,
        summary: manifest.summary,
        license: manifest.license,
        sourceType: "community",
        sourceUrl: manifest.source?.repo_url ?? null,
        originalAuthor: null,
        verified: false,
        curationNote: "Imported via MCP upload.",
        seededAt: null,
        status: "active",
        reportPenalty: 0,
        searchDocument: `${manifest.name}\n${manifest.summary}`,
        tags: [],
        recommendationScore: null,
        githubStars: null,
        favoriteCount: 0,
        downloadCount: 0,
        shareCount: 0,
        commentCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      db.lobsters.push(lobster);
    } else if (lobster.ownerId !== userId) {
      throw new ApiError(403, "Cannot upload version for another author");
    }

    if (db.lobsterVersions.some((item) => item.lobsterId === lobster!.id && item.version === manifest.version)) {
      throw new ApiError(409, "version already exists");
    }

    const base = `lobsters/${lobster.slug}/${manifest.version}`;
    const migratedReadmeText = await mirrorGithubReadmeAssets({
      lobsterSlug: lobster.slug,
      version: manifest.version,
      readmeMarkdown: files.readmeRaw.toString("utf8"),
      sourceRepo: manifest.source?.repo_url,
      sourceCommit: manifest.source?.commit,
    });
    const repoSignals = await fetchGithubRepoSignals(manifest.source?.repo_url);
    const readmeUrl = await putObject(
      `${base}/README.md`,
      Buffer.from(migratedReadmeText, "utf8"),
      "text/markdown",
    );
    const manifestUrl = await putObject(`${base}/manifest.json`, files.manifestRaw, "application/json");
    const skillsBundleUrl = await putObject(`${base}/skills_bundle.zip`, files.skillsRaw, "application/zip");
    const icon = generateProceduralLobsterIcon({
      slug: lobster.slug,
      version: manifest.version,
      tags: lobster.tags,
      sourceType: lobster.sourceType,
      workspacePaths: [],
      readmeText: migratedReadmeText,
      summary: lobster.summary,
    });
    const iconUrl = await putObject(iconStorageKey(lobster.slug, manifest.version, icon.contentType), icon.body, icon.contentType);
    const now = new Date().toISOString();

    const createdVersion = {
      id: db.nextIds.lobsterVersion++,
      lobsterId: lobster.id,
      createdBy: userId,
      version: manifest.version,
      changelog: "Uploaded via MCP",
      readmeText: migratedReadmeText,
      manifestUrl,
      readmeUrl,
      skillsBundleUrl,
      iconUrl,
      iconSeed: icon.seed,
      iconSpecVersion: icon.specVersion,
      sourceRepo: manifest.source?.repo_url ?? null,
      sourceCommit: manifest.source?.commit ?? null,
      workspaceFiles: [],
      publishClient: "mcp-upload",
      maskedSecretsCount: 0,
      blockedFilesCount: 0,
      skills: manifest.skills.map((skill) => ({
        skillId: skill.id,
        name: skill.name,
        entry: skill.entry,
        path: skill.path,
        digest: skill.digest ?? null,
        size: skill.size ?? null,
      })),
      createdAt: now,
    };
    db.lobsterVersions.push(createdVersion);
    lobster.githubStars = repoSignals?.stars ?? lobster.githubStars ?? null;

    const tagSetting = manifest.settings.find((item) => item.key === "tags");
    if (Array.isArray(tagSetting?.value)) {
      lobster.tags = [...new Set(tagSetting.value.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
    }
    lobster.searchDocument = `${lobster.name}\n${lobster.summary}\n${migratedReadmeText}`;
    lobster.updatedAt = now;

    return {
      created_version_id: createdVersion.id,
      lobster_slug: lobster.slug,
      version: manifest.version,
      manifest_url: manifestUrl,
      readme_url: readmeUrl,
      skills_bundle_url: skillsBundleUrl,
    };
  });

  await enqueueIconGenerationJob(result.created_version_id);
  void kickIconJobWorker();
  return {
    lobster_slug: result.lobster_slug,
    version: result.version,
    manifest_url: result.manifest_url,
    readme_url: result.readme_url,
    skills_bundle_url: result.skills_bundle_url,
  };
}

export async function publishWorkspace(userId: number, payload: WorkspacePublishPayload) {
  const readmeMarkdown = payload.readme_markdown?.trim() || await generateWorkspaceReadme(payload);
  const db = await readDb();
  const existing = db.lobsters.find((item) => item.slug === payload.lobster_slug);

  let slug = payload.lobster_slug;
  if (!existing) {
    const created = await createLobster(userId, {
      name: payload.name,
      summary: payload.summary,
      license: payload.license,
      tags: payload.tags,
    });
    slug = created.slug;
  } else {
    if (existing.ownerId !== userId) {
      throw new ApiError(403, "Cannot publish workspace for another author");
    }

    await mutateDb((draft) => {
      const lobster = draft.lobsters.find((item) => item.slug === existing.slug);
      if (!lobster) return;
      lobster.name = payload.name.trim();
      lobster.summary = payload.summary.trim();
      lobster.license = payload.license;
      lobster.tags = [...new Set(payload.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
      lobster.updatedAt = new Date().toISOString();
      lobster.searchDocument = [lobster.name, lobster.summary, lobster.tags.join(" ")].join("\n");
    });
  }

  const version = await createVersion(userId, slug, {
    version: payload.version,
    changelog: payload.changelog,
    readme_markdown: readmeMarkdown,
    source_repo: payload.source_repo,
    source_commit: payload.source_commit,
    icon_base64: payload.icon_base64,
    icon_content_type: payload.icon_content_type,
    icon_seed: payload.icon_seed,
    icon_spec_version: payload.icon_spec_version,
    publish_client: payload.publish_client,
    masked_secrets_count: payload.stats.masked_secrets_count,
    blocked_files_count: payload.stats.blocked_files_count,
    workspace_files: payload.workspace_files,
    skills: payload.skills,
    settings: payload.settings,
  });

  return {
    lobster_slug: slug,
    version: version.version,
    blocked_files_count: payload.stats.blocked_files_count,
    masked_secrets_count: payload.stats.masked_secrets_count,
    shared_files_count: payload.stats.shared_files,
  };
}

export async function listSeeds(): Promise<SeedRecord[]> {
  const db = await readDb();
  return db.lobsters
    .filter((item) => item.seededAt || item.sourceType !== "community")
    .map((item) => ({
      slug: item.slug,
      source_type: item.sourceType,
      source_url: item.sourceUrl,
      original_author: item.originalAuthor,
      verified: item.verified,
      curation_note: item.curationNote,
      seeded_at: item.seededAt,
    }))
    .sort((a, b) => {
      if (!a.seeded_at || !b.seeded_at) return 0;
      return +new Date(b.seeded_at) - +new Date(a.seeded_at);
    });
}

export async function upsertSeedMetadata(
  actorId: number,
  payload: {
    slug: string;
    source_type: "official" | "curated" | "community" | "demo";
    source_url?: string;
    original_author?: string;
    verified?: boolean;
    curation_note?: string;
    seeded?: boolean;
  },
) {
  const db = await readDb();
  const actor = db.users.find((item) => item.id === actorId);
  if (!actor || actor.handle !== "clawhub") {
    throw new ApiError(403, "Only clawhub can manage seeds");
  }

  return mutateDb((draft) => {
    const lobster = draft.lobsters.find((item) => item.slug === payload.slug);
    if (!lobster) throw new ApiError(404, "Lobster not found");
    lobster.sourceType = payload.source_type;
    lobster.sourceUrl = payload.source_url ?? null;
    lobster.originalAuthor = payload.original_author ?? null;
    lobster.verified = payload.verified ?? lobster.verified;
    lobster.curationNote = payload.curation_note ?? null;
    lobster.seededAt = payload.seeded === false ? null : lobster.seededAt ?? new Date().toISOString();
    return {
      slug: lobster.slug,
      source_type: lobster.sourceType,
      source_url: lobster.sourceUrl,
      original_author: lobster.originalAuthor,
      verified: lobster.verified,
      curation_note: lobster.curationNote,
      seeded_at: lobster.seededAt,
    };
  });
}
