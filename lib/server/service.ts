import { CommentItem, LobsterDetail, LobsterSummary, LobsterVersion, MeProfile, SeedRecord, UserProfile } from "@/lib/types";

import { ApiError } from "./errors";
import { parseAndValidateManifest } from "./manifest";
import { allowRate } from "./rate-limit";
import { mutateDb, readDb } from "./store";
import { putObject, resolvePublicAssetUrl } from "./storage";
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

function toSummary(item: DbLobster, owner: DbUser): LobsterSummary {
  return {
    slug: item.slug,
    name: item.name,
    summary: item.summary,
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
    favorite_count: item.favoriteCount,
    comment_count: item.commentCount,
    hot_score: computeHotScore(item.favoriteCount, item.commentCount, new Date(item.createdAt), item.reportPenalty),
    is_hireable: item.isHireable,
    status: item.status,
    created_at: item.createdAt,
  };
}

function toVersion(version: DbLobsterVersion): LobsterVersion {
  return {
    version: version.version,
    changelog: version.changelog,
    readme_text: version.readmeText,
    manifest_url: resolvePublicAssetUrl(version.manifestUrl) ?? version.manifestUrl,
    readme_url: resolvePublicAssetUrl(version.readmeUrl) ?? version.readmeUrl,
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
      content_excerpt: file.contentExcerpt,
      content_text: file.contentText,
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
  return {
    ...summary,
    latest_version: versions.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]?.version ?? null,
  };
}

export async function listLobsters(params?: { sort?: string; tag?: string; q?: string }) {
  const db = await readDb();
  let items = db.lobsters.filter((item) => item.status === "active");
  if (params?.tag?.trim()) {
    const tag = params.tag.trim().toLowerCase();
    items = items.filter((item) => item.tags.includes(tag));
  }
  if (params?.q?.trim()) {
    const q = params.q.trim().toLowerCase();
    items = items.filter((item) => item.searchDocument.toLowerCase().includes(q));
  }

  const summaries = items.map((item) => {
    const owner = db.users.find((user) => user.id === item.ownerId)!;
    const versions = db.lobsterVersions.filter((version) => version.lobsterId === item.id);
    return attachLatestVersion(toSummary(item, owner), versions);
  });

  summaries.sort((a, b) => {
    if (params?.sort === "new") return +new Date(b.created_at) - +new Date(a.created_at);
    if (b.hot_score !== a.hot_score) return b.hot_score - a.hot_score;
    return +new Date(b.created_at) - +new Date(a.created_at);
  });

  return { items: summaries, total: summaries.length };
}

export async function getLobsterBySlug(slug: string): Promise<LobsterDetail> {
  const db = await readDb();
  const lobster = db.lobsters.find((item) => item.slug === slug && item.status === "active");
  if (!lobster) {
    throw new ApiError(404, "Lobster not found");
  }
  const owner = db.users.find((user) => user.id === lobster.ownerId)!;
  const versions = db.lobsterVersions
    .filter((item) => item.lobsterId === lobster.id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return {
    ...attachLatestVersion(toSummary(lobster, owner), versions),
    search_document: lobster.searchDocument,
    versions: versions.map(toVersion),
  };
}

export async function getLobsterVersion(slug: string, version: string) {
  const db = await readDb();
  const lobster = db.lobsters.find((item) => item.slug === slug);
  if (!lobster) throw new ApiError(404, "Lobster not found");
  const found = db.lobsterVersions.find((item) => item.lobsterId === lobster.id && item.version === version);
  if (!found) throw new ApiError(404, "Version not found");
  return toVersion(found);
}

export async function createLobster(
  userId: number,
  payload: {
    name: string;
    summary: string;
    license: string;
    tags: string[];
    is_hireable: boolean;
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
      isHireable: payload.is_hireable,
      status: "active",
      reportPenalty: 0,
      searchDocument: [payload.name.trim(), payload.summary.trim(), tags.join(" ")].join("\n"),
      tags,
      favoriteCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    db.lobsters.push(lobster);
    const owner = db.users.find((user) => user.id === userId)!;
    return {
      ...attachLatestVersion(toSummary(lobster, owner), []),
      search_document: lobster.searchDocument,
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
    source_repo?: string;
    source_commit?: string;
    workspace_files?: Array<{
      path: string;
      size: number;
      kind: "text" | "binary";
      content_excerpt?: string | null;
      content_text?: string | null;
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

  return mutateDb(async (db) => {
    const lobster = db.lobsters.find((item) => item.slug === slug);
    if (!lobster) throw new ApiError(404, "Lobster not found");
    if (lobster.ownerId !== userId) throw new ApiError(403, "Only owner can publish versions");
    if (db.lobsterVersions.some((item) => item.lobsterId === lobster.id && item.version === payload.version)) {
      throw new ApiError(409, "version already exists");
    }

    const manifest = {
      schema_version: "1.0",
      lobster_slug: lobster.slug,
      version: payload.version,
      name: lobster.name,
      summary: lobster.summary,
      license: lobster.license,
      readme_path: "README.md",
      skills: payload.skills,
      settings: payload.settings,
      source: {
        repo_url: payload.source_repo,
        commit: payload.source_commit,
      },
    };

    const readmeUrl = await putObject(
      `lobsters/${lobster.slug}/${payload.version}/README.md`,
      Buffer.from(payload.readme_markdown, "utf8"),
      "text/markdown",
    );
    const manifestUrl = await putObject(
      `lobsters/${lobster.slug}/${payload.version}/manifest.json`,
      Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      "application/json",
    );

    const now = new Date().toISOString();
    const created: DbLobsterVersion = {
      id: db.nextIds.lobsterVersion++,
      lobsterId: lobster.id,
      createdBy: userId,
      version: payload.version,
      changelog: payload.changelog.trim(),
      readmeText: payload.readme_markdown,
      manifestUrl,
      readmeUrl,
      skillsBundleUrl: null,
      sourceRepo: payload.source_repo ?? null,
      sourceCommit: payload.source_commit ?? null,
      workspaceFiles: (payload.workspace_files ?? []).map((file) => ({
        path: file.path,
        size: file.size,
        kind: file.kind,
        contentExcerpt: file.content_excerpt ?? null,
        contentText: file.content_text ?? null,
        maskedCount: file.masked_count ?? 0,
      })),
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
    lobster.updatedAt = now;
    lobster.searchDocument = [
      lobster.name,
      lobster.summary,
      payload.readme_markdown,
      lobster.tags.join(" "),
      ...(payload.workspace_files ?? []).map((file) => `${file.path}\n${file.content_excerpt ?? ""}`),
    ].join("\n");
    return toVersion(created);
  });
}

export async function getComments(slug: string): Promise<CommentItem[]> {
  const db = await readDb();
  const lobster = db.lobsters.find((item) => item.slug === slug);
  if (!lobster) throw new ApiError(404, "Lobster not found");
  return db.comments
    .filter((item) => item.lobsterId === lobster.id)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .map((comment) => {
      const user = db.users.find((item) => item.id === comment.userId)!;
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

export async function addComment(userId: number, slug: string, content: string) {
  if (!(await allowRate(`comment:${userId}`, 20, 60))) throw new ApiError(429, "Too many comments");
  const clean = sanitizeText(content);
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

  return mutateDb(async (db) => {
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
        isHireable: false,
        status: "active",
        reportPenalty: 0,
        searchDocument: `${manifest.name}\n${manifest.summary}`,
        tags: [],
        favoriteCount: 0,
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
    const readmeUrl = await putObject(`${base}/README.md`, files.readmeRaw, "text/markdown");
    const manifestUrl = await putObject(`${base}/manifest.json`, files.manifestRaw, "application/json");
    const skillsBundleUrl = await putObject(`${base}/skills_bundle.zip`, files.skillsRaw, "application/zip");
    const now = new Date().toISOString();

    db.lobsterVersions.push({
      id: db.nextIds.lobsterVersion++,
      lobsterId: lobster.id,
      createdBy: userId,
      version: manifest.version,
      changelog: "Uploaded via MCP",
      readmeText: files.readmeRaw.toString("utf8"),
      manifestUrl,
      readmeUrl,
      skillsBundleUrl,
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
    });

    const tagSetting = manifest.settings.find((item) => item.key === "tags");
    if (Array.isArray(tagSetting?.value)) {
      lobster.tags = [...new Set(tagSetting.value.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
    }
    lobster.searchDocument = `${lobster.name}\n${lobster.summary}\n${files.readmeRaw.toString("utf8")}`;
    lobster.updatedAt = now;

    return {
      lobster_slug: lobster.slug,
      version: manifest.version,
      manifest_url: manifestUrl,
      readme_url: readmeUrl,
      skills_bundle_url: skillsBundleUrl,
    };
  });
}

export async function publishWorkspace(userId: number, payload: WorkspacePublishPayload) {
  const db = await readDb();
  const existing = db.lobsters.find((item) => item.slug === payload.lobster_slug);

  let slug = payload.lobster_slug;
  if (!existing) {
    const created = await createLobster(userId, {
      name: payload.name,
      summary: payload.summary,
      license: payload.license,
      tags: payload.tags,
      is_hireable: false,
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
    readme_markdown: payload.readme_markdown,
    source_repo: payload.source_repo,
    source_commit: payload.source_commit,
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
