import fs from "node:fs/promises";
import path from "node:path";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import type {
  DbComment,
  DbLegacyNextIds,
  DbLobster,
  DbLobsterVersion,
  DbState,
  DbUser,
  DbWorkspaceFile,
} from "./types";

const dataDir = path.resolve(process.env.CLAWLODGE_DATA_DIR || path.join(process.cwd(), "data"));
const legacyJsonPath = path.join(dataDir, "app-db.json");
const SCHEMA_INIT_LOCK = { classId: 20260313, objectId: 1 };

let pool: Pool | null = null;
let initialized = false;

type MirrorDetailRow = {
  lobster: DbLobster;
  owner: DbUser;
  versions: DbLobsterVersion[];
};

export type DbIdKey = keyof DbLegacyNextIds;

export type DbMutationContext = {
  allocateId: (key: DbIdKey) => Promise<number>;
};

const ID_SEQUENCES: Record<DbIdKey, string> = {
  user: "users_id_seq",
  session: "sessions_id_seq",
  apiToken: "api_tokens_id_seq",
  hireProfile: "hire_profiles_id_seq",
  lobster: "lobsters_id_seq",
  lobsterVersion: "lobster_versions_id_seq",
  comment: "comments_id_seq",
  report: "reports_id_seq",
  iconJob: "icon_jobs_id_seq",
};

function emptyState(): DbState {
  return {
    users: [],
    sessions: [],
    apiTokens: [],
    hireProfiles: [],
    lobsters: [],
    lobsterVersions: [],
    comments: [],
    reports: [],
    iconJobs: [],
  };
}

function normalizeState(parsed: DbState) {
  parsed.users = parsed.users ?? [];
  parsed.sessions = parsed.sessions ?? [];
  parsed.apiTokens = parsed.apiTokens ?? [];
  parsed.hireProfiles = parsed.hireProfiles ?? [];
  parsed.lobsters = (parsed.lobsters ?? []).map((lobster) => ({
    ...lobster,
    category: lobster.category ?? null,
    recommendationScore: lobster.recommendationScore ?? null,
    githubStars: lobster.githubStars ?? null,
    downloadCount: lobster.downloadCount ?? 0,
    shareCount: lobster.shareCount ?? 0,
  }));
  parsed.lobsterVersions = (parsed.lobsterVersions ?? []).map((version) => ({
    ...version,
    iconUrl: version.iconUrl ?? null,
    iconSeed: version.iconSeed ?? null,
    iconSpecVersion: version.iconSpecVersion ?? null,
    workspaceFiles: Array.isArray(version.workspaceFiles)
      ? version.workspaceFiles.map((file) => ({
          ...file,
          contentText: file.contentText ?? null,
          contentType: file.contentType ?? null,
          storageUrl: file.storageUrl ?? null,
          maskedCount: file.maskedCount ?? 0,
        }))
      : undefined,
    publishClient: version.publishClient ?? null,
    maskedSecretsCount: version.maskedSecretsCount ?? 0,
    blockedFilesCount: version.blockedFilesCount ?? 0,
  }));
  parsed.comments = parsed.comments ?? [];
  parsed.reports = parsed.reports ?? [];
  parsed.iconJobs = (parsed.iconJobs ?? []).map((job) => ({
    ...job,
    status: job.status ?? "pending",
    attempts: job.attempts ?? 0,
    lastError: job.lastError ?? null,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
  }));
  return parsed;
}

function versionsWithInlineWorkspaceFiles(state: DbState) {
  return state.lobsterVersions.filter((version) => Array.isArray(version.workspaceFiles));
}

function stripWorkspaceFilesFromState(state: DbState): DbState {
  const rest = { ...state };
  delete rest.nextIds;
  return {
    ...rest,
    lobsterVersions: state.lobsterVersions.map((version) => ({
      ...version,
      workspaceFiles: undefined,
    })),
  };
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  return JSON.parse(raw) as T[];
}

function sanitizeJsonString(value: string) {
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

function sanitizeForJson<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeJsonString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForJson(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitizeForJson(nested)]),
    ) as T;
  }
  return value;
}

function safeJsonStringify(value: unknown) {
  return JSON.stringify(sanitizeForJson(value));
}

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL store");
    pool = new Pool({ connectionString });
  }
  return pool;
}

async function query<T extends QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}

async function ensureDataDir() {
  await fs.mkdir(path.dirname(legacyJsonPath), { recursive: true });
}

async function loadLegacyStateFromJson() {
  try {
    const raw = await fs.readFile(legacyJsonPath, "utf8");
    return normalizeState(JSON.parse(raw) as DbState);
  } catch {
    return emptyState();
  }
}

async function loadSeedState() {
  await ensureDataDir();
  return loadLegacyStateFromJson();
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSchema(client: PoolClient) {
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

  for (const sequenceName of Object.values(ID_SEQUENCES)) {
    await client.query(`CREATE SEQUENCE IF NOT EXISTS ${sequenceName}`);
  }

  await client.query("ALTER TABLE users_mirror ALTER COLUMN id SET DEFAULT nextval('users_id_seq')");
  await client.query("ALTER TABLE lobsters_mirror ALTER COLUMN id SET DEFAULT nextval('lobsters_id_seq')");
  await client.query("ALTER TABLE lobster_versions_mirror ALTER COLUMN id SET DEFAULT nextval('lobster_versions_id_seq')");
  await client.query("ALTER TABLE comments_mirror ALTER COLUMN id SET DEFAULT nextval('comments_id_seq')");
}

async function allocateId(client: PoolClient, key: DbIdKey) {
  const result = await client.query<{ id: string }>("SELECT nextval($1::regclass) AS id", [ID_SEQUENCES[key]]);
  const value = Number(result.rows[0]?.id);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Failed to allocate id for ${key}`);
  }
  return value;
}

async function setSequenceValue(client: PoolClient, key: DbIdKey, value: number) {
  if (value > 0) {
    await client.query("SELECT setval($1::regclass, $2, true)", [ID_SEQUENCES[key], value]);
  } else {
    await client.query("SELECT setval($1::regclass, 1, false)", [ID_SEQUENCES[key]]);
  }
}

async function syncStateSequences(client: PoolClient, state: DbState) {
  await setSequenceValue(client, "user", Math.max(...state.users.map((item) => item.id), 0));
  await setSequenceValue(client, "session", Math.max(...state.sessions.map((item) => item.id), 0));
  await setSequenceValue(client, "apiToken", Math.max(...state.apiTokens.map((item) => item.id), 0));
  await setSequenceValue(client, "hireProfile", Math.max(...state.hireProfiles.map((item) => item.id), 0));
  await setSequenceValue(client, "lobster", Math.max(...state.lobsters.map((item) => item.id), 0));
  await setSequenceValue(client, "lobsterVersion", Math.max(...state.lobsterVersions.map((item) => item.id), 0));
  await setSequenceValue(client, "comment", Math.max(...state.comments.map((item) => item.id), 0));
  await setSequenceValue(client, "report", Math.max(...state.reports.map((item) => item.id), 0));
  await setSequenceValue(client, "iconJob", Math.max(...state.iconJobs.map((item) => item.id), 0));
}

async function syncWorkspaceEntries(client: PoolClient, state: DbState) {
  const versions = versionsWithInlineWorkspaceFiles(state);
  if (!versions.length) return;
  await client.query("DELETE FROM workspace_entries WHERE version_id = ANY($1::int[])", [versions.map((version) => version.id)]);
  for (const version of versions) {
    for (const file of version.workspaceFiles ?? []) {
      await client.query(
        `INSERT INTO workspace_entries
          (version_id, path, size, kind, content_excerpt, content_text, content_type, storage_url, masked_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          version.id,
          file.path,
          file.size,
          file.kind,
          file.contentExcerpt ?? null,
          file.contentText ?? null,
          file.contentType ?? null,
          file.storageUrl ?? null,
          file.maskedCount ?? 0,
        ],
      );
    }
  }
}

async function syncMirrorTables(client: PoolClient, state: DbState) {
  await client.query("DELETE FROM comments_mirror");
  await client.query("DELETE FROM lobster_versions_mirror");
  await client.query("DELETE FROM lobsters_mirror");
  await client.query("DELETE FROM users_mirror");

  for (const user of state.users) {
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

  for (const lobster of state.lobsters) {
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

  for (const version of state.lobsterVersions) {
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
        version.maskedSecretsCount,
        version.blockedFilesCount,
        safeJsonStringify(version.skills ?? []),
        version.createdAt,
      ],
    );
  }

  for (const comment of state.comments) {
    await client.query(
      `INSERT INTO comments_mirror (id, user_id, lobster_id, content, created_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [comment.id, comment.userId, comment.lobsterId, comment.content, comment.createdAt],
    );
  }
}

async function persistState(client: PoolClient, state: DbState) {
  const now = new Date().toISOString();
  const persisted = stripWorkspaceFilesFromState(state);
  await client.query("UPDATE app_state SET payload = $1::jsonb, updated_at = $2 WHERE id = 1", [safeJsonStringify(persisted), now]);
  await syncWorkspaceEntries(client, state);
  await syncMirrorTables(client, persisted);
  await syncStateSequences(client, state);
}

async function loadDbWithClient(client: PoolClient) {
  const result = await client.query<{ payload: DbState | string }>("SELECT payload FROM app_state WHERE id = 1");
  const payload = result.rows[0]?.payload;
  if (!payload) {
    return emptyState();
  }
  return normalizeState(typeof payload === "string" ? JSON.parse(payload) as DbState : payload as DbState);
}

async function ensureDatabase() {
  if (initialized) return;
  await withTransaction(async (client) => {
    // Serialize first-run schema/bootstrap work across processes to avoid DDL deadlocks.
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [SCHEMA_INIT_LOCK.classId, SCHEMA_INIT_LOCK.objectId]);
    await ensureSchema(client);
    const existing = await client.query<{ id: number }>("SELECT id FROM app_state WHERE id = 1");
    if (!existing.rowCount) {
      const state = await loadSeedState();
      const persisted = stripWorkspaceFilesFromState(state);
      await syncWorkspaceEntries(client, state);
      await client.query(
        "INSERT INTO app_state (id, payload, updated_at) VALUES (1, $1::jsonb, $2)",
        [safeJsonStringify(persisted), new Date().toISOString()],
      );
      await syncMirrorTables(client, persisted);
      await syncStateSequences(client, state);
    } else {
      const state = await loadDbWithClient(client);
      if (versionsWithInlineWorkspaceFiles(state).length || state.nextIds) {
        await persistState(client, state);
      } else {
        await syncStateSequences(client, state);
      }
    }
  });
  initialized = true;
}

async function loadDb() {
  await ensureDatabase();
  return withTransaction((client) => loadDbWithClient(client));
}

function toMirrorLobster(row: Record<string, unknown>): DbLobster {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    ownerId: Number(row.owner_id),
    name: String(row.name),
    summary: String(row.summary),
    category: row.category == null ? null : String(row.category) as DbLobster["category"],
    license: String(row.license),
    sourceType: row.source_type as DbLobster["sourceType"],
    sourceUrl: row.source_url == null ? null : String(row.source_url),
    originalAuthor: row.original_author == null ? null : String(row.original_author),
    verified: Boolean(row.verified),
    curationNote: row.curation_note == null ? null : String(row.curation_note),
    seededAt: row.seeded_at == null ? null : String(row.seeded_at),
    status: row.status as DbLobster["status"],
    reportPenalty: Number(row.report_penalty),
    searchDocument: String(row.search_document),
    tags: typeof row.tags_json === "string" ? parseJsonArray<string>(row.tags_json) : (row.tags_json as string[] | null) ?? [],
    recommendationScore: row.recommendation_score == null ? null : Number(row.recommendation_score),
    githubStars: row.github_stars == null ? null : Number(row.github_stars),
    favoriteCount: Number(row.favorite_count),
    downloadCount: Number(row.download_count),
    shareCount: Number(row.share_count),
    commentCount: Number(row.comment_count),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toMirrorVersion(row: Record<string, unknown>): DbLobsterVersion {
  return {
    id: Number(row.id),
    lobsterId: Number(row.lobster_id),
    createdBy: Number(row.created_by),
    version: String(row.version),
    changelog: String(row.changelog),
    readmeText: String(row.readme_text),
    manifestUrl: String(row.manifest_url),
    readmeUrl: String(row.readme_url),
    skillsBundleUrl: row.skills_bundle_url == null ? null : String(row.skills_bundle_url),
    iconUrl: row.icon_url == null ? null : String(row.icon_url),
    iconSeed: row.icon_seed == null ? null : String(row.icon_seed),
    iconSpecVersion: row.icon_spec_version == null ? null : String(row.icon_spec_version),
    sourceRepo: row.source_repo == null ? null : String(row.source_repo),
    sourceCommit: row.source_commit == null ? null : String(row.source_commit),
    workspaceFiles: typeof row.workspace_files_json === "string"
      ? parseJsonArray<DbWorkspaceFile>(row.workspace_files_json)
      : (row.workspace_files_json as DbWorkspaceFile[] | null) ?? [],
    publishClient: row.publish_client == null ? null : String(row.publish_client),
    maskedSecretsCount: Number(row.masked_secrets_count),
    blockedFilesCount: Number(row.blocked_files_count),
    skills: typeof row.skills_json === "string"
      ? parseJsonArray<DbLobsterVersion["skills"][number]>(row.skills_json)
      : (row.skills_json as DbLobsterVersion["skills"]) ?? [],
    createdAt: String(row.created_at),
  };
}

function toMirrorComment(row: Record<string, unknown>): DbComment {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    lobsterId: Number(row.lobster_id),
    content: String(row.content),
    createdAt: String(row.created_at),
  };
}

export async function readDb() {
  return loadDb();
}

export async function writeDb(next: DbState) {
  await ensureDatabase();
  await withTransaction((client) => persistState(client, next));
}

export async function mutateDb<T>(fn: (state: DbState, context: DbMutationContext) => T | Promise<T>): Promise<T> {
  await ensureDatabase();
  return withTransaction(async (client) => {
    const state = await loadDbWithClient(client);
    const result = await fn(state, {
      allocateId: (key) => allocateId(client, key),
    });
    await persistState(client, state);
    return result;
  });
}

export async function readMirroredLobsterSummaries() {
  await ensureDatabase();
  const result = await query<Record<string, unknown>>(`
    SELECT
      l.*,
      u.handle AS owner_handle,
      u.display_name AS owner_display_name,
      lv.version AS latest_version,
      lv.source_repo AS latest_source_repo,
      lv.icon_url AS latest_icon_url,
      lv.created_at AS latest_created_at
    FROM lobsters_mirror l
    JOIN users_mirror u ON u.id = l.owner_id
    LEFT JOIN LATERAL (
      SELECT *
      FROM lobster_versions_mirror
      WHERE lobster_id = l.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) lv ON TRUE
    WHERE l.status = 'active'
  `);

  return result.rows.map((row) => ({
    lobster: toMirrorLobster(row),
    owner: {
      handle: String(row.owner_handle),
      displayName: row.owner_display_name == null ? null : String(row.owner_display_name),
    },
    latestVersion: row.latest_version == null ? null : String(row.latest_version),
    latestSourceRepo: row.latest_source_repo == null ? null : String(row.latest_source_repo),
    latestIconUrl: row.latest_icon_url == null ? null : String(row.latest_icon_url),
    latestCreatedAt: row.latest_created_at == null ? null : String(row.latest_created_at),
  }));
}

export async function readMirroredLobsterDetail(slug: string): Promise<MirrorDetailRow | null> {
  await ensureDatabase();
  const result = await query<Record<string, unknown>>(
    `SELECT
      l.*,
      u.id AS user_id,
      u.handle,
      u.display_name,
      u.avatar_url,
      u.bio,
      u.email,
      u.github_id,
      u.favorite_slugs_json,
      u.created_at AS user_created_at,
      u.updated_at AS user_updated_at
     FROM lobsters_mirror l
     JOIN users_mirror u ON u.id = l.owner_id
     WHERE l.slug = $1 AND l.status = 'active'
     LIMIT 1`,
    [slug],
  );
  const row = result.rows[0];
  if (!row) return null;
  const lobster = toMirrorLobster(row);
  const owner: DbUser = {
    id: Number(row.user_id),
    handle: String(row.handle),
    displayName: row.display_name == null ? null : String(row.display_name),
    avatarUrl: row.avatar_url == null ? null : String(row.avatar_url),
    bio: row.bio == null ? null : String(row.bio),
    email: row.email == null ? null : String(row.email),
    githubId: row.github_id == null ? null : String(row.github_id),
    favoriteSlugs: typeof row.favorite_slugs_json === "string" ? parseJsonArray<string>(row.favorite_slugs_json) : (row.favorite_slugs_json as string[] | null) ?? [],
    createdAt: String(row.user_created_at),
    updatedAt: String(row.user_updated_at),
  };

  const versionsResult = await query<Record<string, unknown>>(
    `SELECT * FROM lobster_versions_mirror WHERE lobster_id = $1 ORDER BY created_at DESC, id DESC`,
    [lobster.id],
  );
  const versions = versionsResult.rows.map(toMirrorVersion);
  if (versions.length) {
    const ids = versions.map((version) => version.id);
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM workspace_entries WHERE version_id = ANY($1::int[]) ORDER BY path ASC`,
      [ids],
    );
    const filesByVersion = new Map<number, DbWorkspaceFile[]>();
    for (const entry of rows.rows) {
      const versionId = Number(entry.version_id);
      const bucket = filesByVersion.get(versionId) ?? [];
      bucket.push({
        path: String(entry.path),
        size: Number(entry.size),
        kind: entry.kind as DbWorkspaceFile["kind"],
        contentExcerpt: entry.content_excerpt == null ? null : String(entry.content_excerpt),
        contentText: entry.content_text == null ? null : String(entry.content_text),
        contentType: entry.content_type == null ? null : String(entry.content_type),
        storageUrl: entry.storage_url == null ? null : String(entry.storage_url),
        maskedCount: Number(entry.masked_count),
      });
      filesByVersion.set(versionId, bucket);
    }
    for (const version of versions) {
      version.workspaceFiles = filesByVersion.get(version.id) ?? [];
    }
  }

  return { lobster, owner, versions };
}

export async function readMirroredLobsterVersion(slug: string, version: string, includeHidden = false) {
  await ensureDatabase();
  const result = await query<Record<string, unknown>>(
    `SELECT l.*, lv.*
     FROM lobsters_mirror l
     JOIN lobster_versions_mirror lv ON lv.lobster_id = l.id
     WHERE l.slug = $1 AND lv.version = $2 ${includeHidden ? "" : "AND l.status = 'active'"}
     LIMIT 1`,
    [slug, version],
  );
  const row = result.rows[0];
  if (!row) return null;
  const mirroredVersion = toMirrorVersion(row);
  const workspaceRows = await query<Record<string, unknown>>(
    `SELECT * FROM workspace_entries WHERE version_id = $1 ORDER BY path ASC`,
    [mirroredVersion.id],
  );
  mirroredVersion.workspaceFiles = workspaceRows.rows.map((entry) => ({
    path: String(entry.path),
    size: Number(entry.size),
    kind: entry.kind as DbWorkspaceFile["kind"],
    contentExcerpt: entry.content_excerpt == null ? null : String(entry.content_excerpt),
    contentText: entry.content_text == null ? null : String(entry.content_text),
    contentType: entry.content_type == null ? null : String(entry.content_type),
    storageUrl: entry.storage_url == null ? null : String(entry.storage_url),
    maskedCount: Number(entry.masked_count),
  }));
  return {
    lobster: toMirrorLobster(row),
    version: mirroredVersion,
  };
}

export async function readWorkspaceEntriesForVersionId(versionId: number) {
  await ensureDatabase();
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM workspace_entries WHERE version_id = $1 ORDER BY path ASC`,
    [versionId],
  );
  return result.rows.map((entry) => ({
    path: String(entry.path),
    size: Number(entry.size),
    kind: entry.kind as DbWorkspaceFile["kind"],
    contentExcerpt: entry.content_excerpt == null ? null : String(entry.content_excerpt),
    contentText: entry.content_text == null ? null : String(entry.content_text),
    contentType: entry.content_type == null ? null : String(entry.content_type),
    storageUrl: entry.storage_url == null ? null : String(entry.storage_url),
    maskedCount: Number(entry.masked_count),
  }));
}

export async function readMirroredComments(slug: string) {
  await ensureDatabase();
  const lobsterResult = await query<{ id: number }>(
    `SELECT id FROM lobsters_mirror WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  const lobsterRow = lobsterResult.rows[0];
  if (!lobsterRow) return null;
  const result = await query<Record<string, unknown>>(
    `SELECT c.*, u.handle, u.display_name
     FROM comments_mirror c
     JOIN users_mirror u ON u.id = c.user_id
     WHERE c.lobster_id = $1
     ORDER BY c.created_at ASC, c.id ASC`,
    [lobsterRow.id],
  );
  return result.rows.map((row) => ({
    comment: toMirrorComment(row),
    userHandle: String(row.handle),
    userDisplayName: row.display_name == null ? null : String(row.display_name),
  }));
}
