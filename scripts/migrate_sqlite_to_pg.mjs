import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { Client } from "pg";

function sanitizeJsonString(value) {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        output += value[index] + value[index + 1];
        index += 1;
      } else {
        output += "\uFFFD";
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      output += "\uFFFD";
      continue;
    }
    output += value[index];
  }
  return output;
}

function sanitizeForJson(value) {
  if (typeof value === "string") return sanitizeJsonString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeForJson(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, sanitizeForJson(nested)]));
  }
  return value;
}

function safeJsonStringify(value) {
  return JSON.stringify(sanitizeForJson(value));
}

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users_mirror (
      id INTEGER PRIMARY KEY,
      handle TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      bio TEXT,
      email TEXT,
      github_id TEXT,
      favorite_slugs_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lobsters_mirror (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      summary TEXT NOT NULL,
      category TEXT,
      license TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_url TEXT,
      original_author TEXT,
      verified BOOLEAN NOT NULL,
      curation_note TEXT,
      seeded_at TEXT,
      status TEXT NOT NULL,
      report_penalty INTEGER NOT NULL,
      search_document TEXT NOT NULL,
      tags_json JSONB NOT NULL,
      recommendation_score DOUBLE PRECISION,
      github_stars INTEGER,
      favorite_count INTEGER NOT NULL,
      download_count INTEGER NOT NULL,
      share_count INTEGER NOT NULL,
      comment_count INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lobster_versions_mirror (
      id INTEGER PRIMARY KEY,
      lobster_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      version TEXT NOT NULL,
      changelog TEXT NOT NULL,
      readme_text TEXT NOT NULL,
      manifest_url TEXT NOT NULL,
      readme_url TEXT NOT NULL,
      skills_bundle_url TEXT,
      icon_url TEXT,
      icon_seed TEXT,
      icon_spec_version TEXT,
      source_repo TEXT,
      source_commit TEXT,
      workspace_files_json JSONB NOT NULL,
      publish_client TEXT,
      masked_secrets_count INTEGER NOT NULL,
      blocked_files_count INTEGER NOT NULL,
      skills_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_entries (
      version_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      size INTEGER NOT NULL,
      kind TEXT NOT NULL,
      content_excerpt TEXT,
      content_text TEXT,
      content_type TEXT,
      storage_url TEXT,
      masked_count INTEGER NOT NULL,
      PRIMARY KEY (version_id, path)
    );
    CREATE TABLE IF NOT EXISTS comments_mirror (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      lobster_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lobsters_mirror_status_slug ON lobsters_mirror(status, slug);
    CREATE INDEX IF NOT EXISTS idx_lobsters_mirror_owner ON lobsters_mirror(owner_id);
    CREATE INDEX IF NOT EXISTS idx_versions_mirror_lobster_created ON lobster_versions_mirror(lobster_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workspace_entries_version_path ON workspace_entries(version_id, path);
    CREATE INDEX IF NOT EXISTS idx_comments_mirror_lobster_created ON comments_mirror(lobster_id, created_at ASC);
  `);
}

function stripWorkspaceFiles(state) {
  return {
    ...state,
    lobsterVersions: (state.lobsterVersions || []).map((version) => ({
      ...version,
      workspaceFiles: undefined,
    })),
  };
}

async function main() {
  const dbPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("data/app.db");
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const sqlite = new DatabaseSync(dbPath, { readOnly: true });
  const payloadRow = sqlite.prepare("SELECT payload FROM app_state WHERE id = 1").get();
  if (!payloadRow?.payload) throw new Error(`Missing app_state payload in ${dbPath}`);
  const state = JSON.parse(payloadRow.payload);
  const workspaceEntries = sqlite.prepare(`
    SELECT version_id, path, size, kind, content_excerpt, content_text, content_type, storage_url, masked_count
    FROM workspace_entries
    ORDER BY version_id ASC, path ASC
  `).all();
  const persisted = stripWorkspaceFiles(state);

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await ensureSchema(client);
    await client.query("TRUNCATE workspace_entries, comments_mirror, lobster_versions_mirror, lobsters_mirror, users_mirror, app_state RESTART IDENTITY");
    await client.query(
      "INSERT INTO app_state (id, payload, updated_at) VALUES (1, $1::jsonb, $2)",
      [safeJsonStringify(persisted), new Date().toISOString()],
    );

    for (const user of state.users || []) {
      await client.query(
        `INSERT INTO users_mirror
          (id, handle, display_name, avatar_url, bio, email, github_id, favorite_slugs_json, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
        [
          user.id,
          user.handle,
          user.displayName ?? null,
          user.avatarUrl ?? null,
          user.bio ?? null,
          user.email ?? null,
          user.githubId ?? null,
          safeJsonStringify(user.favoriteSlugs ?? []),
          user.createdAt,
          user.updatedAt,
        ],
      );
    }

    for (const lobster of state.lobsters || []) {
      await client.query(
        `INSERT INTO lobsters_mirror
          (id, slug, owner_id, name, summary, category, license, source_type, source_url, original_author, verified,
           curation_note, seeded_at, status, report_penalty, search_document, tags_json, recommendation_score,
           github_stars, favorite_count, download_count, share_count, comment_count, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24,$25)`,
        [
          lobster.id,
          lobster.slug,
          lobster.ownerId,
          lobster.name,
          lobster.summary ?? "",
          lobster.category ?? null,
          lobster.license,
          lobster.sourceType,
          lobster.sourceUrl ?? null,
          lobster.originalAuthor ?? null,
          lobster.verified,
          lobster.curationNote ?? null,
          lobster.seededAt ?? null,
          lobster.status,
          lobster.reportPenalty,
          lobster.searchDocument ?? "",
          safeJsonStringify(lobster.tags ?? []),
          lobster.recommendationScore ?? null,
          lobster.githubStars ?? null,
          lobster.favoriteCount,
          lobster.downloadCount,
          lobster.shareCount,
          lobster.commentCount,
          lobster.createdAt,
          lobster.updatedAt,
        ],
      );
    }

    for (const version of state.lobsterVersions || []) {
      await client.query(
        `INSERT INTO lobster_versions_mirror
          (id, lobster_id, created_by, version, changelog, readme_text, manifest_url, readme_url, skills_bundle_url,
           icon_url, icon_seed, icon_spec_version, source_repo, source_commit, workspace_files_json, publish_client,
           masked_secrets_count, blocked_files_count, skills_json, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19::jsonb,$20)`,
        [
          version.id,
          version.lobsterId,
          version.createdBy,
          version.version,
          version.changelog,
          version.readmeText,
          version.manifestUrl,
          version.readmeUrl,
          version.skillsBundleUrl ?? null,
          version.iconUrl ?? null,
          version.iconSeed ?? null,
          version.iconSpecVersion ?? null,
          version.sourceRepo ?? null,
          version.sourceCommit ?? null,
          safeJsonStringify([]),
          version.publishClient ?? null,
          version.maskedSecretsCount ?? 0,
          version.blockedFilesCount ?? 0,
          safeJsonStringify(version.skills ?? []),
          version.createdAt,
        ],
      );
    }

    for (const entry of workspaceEntries) {
      await client.query(
        `INSERT INTO workspace_entries
          (version_id, path, size, kind, content_excerpt, content_text, content_type, storage_url, masked_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          entry.version_id,
          entry.path,
          entry.size,
          entry.kind,
          entry.content_excerpt ?? null,
          entry.content_text ?? null,
          entry.content_type ?? null,
          entry.storage_url ?? null,
          entry.masked_count ?? 0,
        ],
      );
    }

    for (const comment of state.comments || []) {
      await client.query(
        `INSERT INTO comments_mirror (id, user_id, lobster_id, content, created_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [comment.id, comment.userId, comment.lobsterId, comment.content, comment.createdAt],
      );
    }

    await client.query("COMMIT");
    const seed = crypto.createHash("sha256").update(JSON.stringify({ users: state.users?.length, lobsters: state.lobsters?.length, versions: state.lobsterVersions?.length, entries: workspaceEntries.length })).digest("hex");
    console.log(JSON.stringify({
      sqlite: dbPath,
      users: state.users?.length ?? 0,
      lobsters: state.lobsters?.length ?? 0,
      versions: state.lobsterVersions?.length ?? 0,
      workspaceEntries: workspaceEntries.length,
      seed,
    }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
