import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  DbComment,
  DbLobster,
  DbLobsterVersion,
  DbState,
  DbUser,
  DbWorkspaceFile,
} from "./types";

const dataDir = path.resolve(process.env.CLAWLODGE_DATA_DIR || path.join(process.cwd(), "data"));
const dbFilePath = process.env.CLAWLODGE_DB_PATH
  ? path.resolve(process.env.CLAWLODGE_DB_PATH)
  : path.join(dataDir, "app.db");
const legacyJsonPath = path.join(dataDir, "app-db.json");

let ioChain: Promise<unknown> = Promise.resolve();
let database: DatabaseSync | null = null;
let initialized = false;

type MirrorDetailRow = {
  lobster: DbLobster;
  owner: DbUser;
  versions: DbLobsterVersion[];
};

function emptyState(): DbState {
  return {
    nextIds: {
      user: 1,
      session: 1,
      apiToken: 1,
      hireProfile: 1,
      lobster: 1,
      lobsterVersion: 1,
      comment: 1,
      report: 1,
      iconJob: 1,
    },
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
  parsed.lobsters = parsed.lobsters.map((lobster) => ({
    ...lobster,
    recommendationScore: lobster.recommendationScore ?? null,
    githubStars: lobster.githubStars ?? null,
    downloadCount: lobster.downloadCount ?? 0,
    shareCount: lobster.shareCount ?? 0,
  }));
  parsed.lobsterVersions = parsed.lobsterVersions.map((version) => ({
    ...version,
    iconUrl: version.iconUrl ?? null,
    iconSeed: version.iconSeed ?? null,
    iconSpecVersion: version.iconSpecVersion ?? null,
    workspaceFiles: (version.workspaceFiles ?? []).map((file) => ({
      ...file,
      contentText: file.contentText ?? null,
      contentType: file.contentType ?? null,
      storageUrl: file.storageUrl ?? null,
      maskedCount: file.maskedCount ?? 0,
    })),
    publishClient: version.publishClient ?? null,
    maskedSecretsCount: version.maskedSecretsCount ?? 0,
    blockedFilesCount: version.blockedFilesCount ?? 0,
  }));
  parsed.iconJobs = (parsed.iconJobs ?? []).map((job) => ({
    ...job,
    status: job.status ?? "pending",
    attempts: job.attempts ?? 0,
    lastError: job.lastError ?? null,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
  }));
  parsed.nextIds.iconJob = parsed.nextIds.iconJob ?? 1;
  return parsed;
}

async function ensureDataDir() {
  await fs.mkdir(path.dirname(dbFilePath), { recursive: true });
}

async function loadLegacyState() {
  try {
    const raw = await fs.readFile(legacyJsonPath, "utf8");
    return normalizeState(JSON.parse(raw) as DbState);
  } catch {
    return emptyState();
  }
}

function openDatabase() {
  if (!database) {
    database = new DatabaseSync(dbFilePath);
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users_mirror (
        id INTEGER PRIMARY KEY,
        handle TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        email TEXT,
        github_id TEXT,
        favorite_slugs_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS lobsters_mirror (
        id INTEGER PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        owner_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        summary TEXT NOT NULL,
        license TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_url TEXT,
        original_author TEXT,
        verified INTEGER NOT NULL,
        curation_note TEXT,
        seeded_at TEXT,
        status TEXT NOT NULL,
        report_penalty INTEGER NOT NULL,
        search_document TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        recommendation_score REAL,
        github_stars INTEGER,
        favorite_count INTEGER NOT NULL,
        download_count INTEGER NOT NULL,
        share_count INTEGER NOT NULL,
        comment_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
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
        workspace_files_json TEXT NOT NULL,
        publish_client TEXT,
        masked_secrets_count INTEGER NOT NULL,
        blocked_files_count INTEGER NOT NULL,
        skills_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments_mirror (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        lobster_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lobsters_mirror_status_slug ON lobsters_mirror(status, slug);
      CREATE INDEX IF NOT EXISTS idx_lobsters_mirror_owner ON lobsters_mirror(owner_id);
      CREATE INDEX IF NOT EXISTS idx_versions_mirror_lobster_created ON lobster_versions_mirror(lobster_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_mirror_lobster_created ON comments_mirror(lobster_id, created_at ASC);
    `);
  }
  return database;
}

function syncMirrorTables(db: DatabaseSync, state: DbState) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      DELETE FROM users_mirror;
      DELETE FROM lobsters_mirror;
      DELETE FROM lobster_versions_mirror;
      DELETE FROM comments_mirror;
    `);

    const insertUser = db.prepare(`
      INSERT INTO users_mirror (
        id, handle, display_name, avatar_url, bio, email, github_id, favorite_slugs_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const user of state.users) {
      insertUser.run(
        user.id,
        user.handle,
        user.displayName,
        user.avatarUrl,
        user.bio,
        user.email,
        user.githubId,
        JSON.stringify(user.favoriteSlugs),
        user.createdAt,
        user.updatedAt,
      );
    }

    const insertLobster = db.prepare(`
      INSERT INTO lobsters_mirror (
        id, slug, owner_id, name, summary, license, source_type, source_url, original_author, verified,
        curation_note, seeded_at, status, report_penalty, search_document, tags_json, recommendation_score,
        github_stars, favorite_count, download_count, share_count, comment_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const lobster of state.lobsters) {
      insertLobster.run(
        lobster.id,
        lobster.slug,
        lobster.ownerId,
        lobster.name,
        lobster.summary,
        lobster.license,
        lobster.sourceType,
        lobster.sourceUrl,
        lobster.originalAuthor,
        lobster.verified ? 1 : 0,
        lobster.curationNote,
        lobster.seededAt,
        lobster.status,
        lobster.reportPenalty,
        lobster.searchDocument,
        JSON.stringify(lobster.tags),
        lobster.recommendationScore,
        lobster.githubStars,
        lobster.favoriteCount,
        lobster.downloadCount,
        lobster.shareCount,
        lobster.commentCount,
        lobster.createdAt,
        lobster.updatedAt,
      );
    }

    const insertVersion = db.prepare(`
      INSERT INTO lobster_versions_mirror (
        id, lobster_id, created_by, version, changelog, readme_text, manifest_url, readme_url, skills_bundle_url,
        icon_url, icon_seed, icon_spec_version, source_repo, source_commit, workspace_files_json, publish_client,
        masked_secrets_count, blocked_files_count, skills_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const version of state.lobsterVersions) {
      insertVersion.run(
        version.id,
        version.lobsterId,
        version.createdBy,
        version.version,
        version.changelog,
        version.readmeText,
        version.manifestUrl,
        version.readmeUrl,
        version.skillsBundleUrl,
        version.iconUrl,
        version.iconSeed,
        version.iconSpecVersion,
        version.sourceRepo,
        version.sourceCommit,
        JSON.stringify(version.workspaceFiles),
        version.publishClient,
        version.maskedSecretsCount,
        version.blockedFilesCount,
        JSON.stringify(version.skills),
        version.createdAt,
      );
    }

    const insertComment = db.prepare(`
      INSERT INTO comments_mirror (id, user_id, lobster_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const comment of state.comments) {
      insertComment.run(comment.id, comment.userId, comment.lobsterId, comment.content, comment.createdAt);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  return JSON.parse(raw) as T[];
}

function toMirrorLobster(row: Record<string, unknown>): DbLobster {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    ownerId: Number(row.owner_id),
    name: String(row.name),
    summary: String(row.summary),
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
    tags: parseJsonArray<string>(String(row.tags_json)),
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
    workspaceFiles: parseJsonArray<DbWorkspaceFile>(String(row.workspace_files_json)),
    publishClient: row.publish_client == null ? null : String(row.publish_client),
    maskedSecretsCount: Number(row.masked_secrets_count),
    blockedFilesCount: Number(row.blocked_files_count),
    skills: parseJsonArray<DbLobsterVersion["skills"][number]>(String(row.skills_json)),
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

async function ensureDatabase() {
  if (initialized) return;
  await ensureDataDir();
  const db = openDatabase();
  const existing = db.prepare("SELECT 1 FROM app_state WHERE id = 1").get() as { 1: number } | undefined;
  if (!existing) {
    const state = await loadLegacyState();
    db.prepare("INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?)")
      .run(JSON.stringify(state), new Date().toISOString());
    syncMirrorTables(db, state);
  } else {
    const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get() as { payload: string };
    syncMirrorTables(db, normalizeState(JSON.parse(row.payload) as DbState));
  }
  initialized = true;
}

async function loadDb() {
  await ensureDatabase();
  const db = openDatabase();
  const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get() as { payload: string } | undefined;
  if (!row) {
    const state = emptyState();
    db.prepare("INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?)")
      .run(JSON.stringify(state), new Date().toISOString());
    return state;
  }
  return normalizeState(JSON.parse(row.payload) as DbState);
}

async function persistDb(next: DbState) {
  await ensureDatabase();
  const db = openDatabase();
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1")
      .run(JSON.stringify(next), now);
    syncMirrorTables(db, next);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function enqueueExclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = ioChain.then(task, task);
  ioChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readDb(): Promise<DbState> {
  await ioChain;
  return loadDb();
}

export async function writeDb(next: DbState) {
  await enqueueExclusive(() => persistDb(next));
}

export async function mutateDb<T>(fn: (state: DbState) => T | Promise<T>): Promise<T> {
  return enqueueExclusive(async () => {
    const state = await loadDb();
    const result = await fn(state);
    await persistDb(state);
    return result;
  });
}

export async function readMirroredLobsterSummaries() {
  await ensureDatabase();
  const db = openDatabase();
  const rows = db.prepare(`
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
    LEFT JOIN lobster_versions_mirror lv ON lv.id = (
      SELECT id
      FROM lobster_versions_mirror
      WHERE lobster_id = l.id
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 1
    )
    WHERE l.status = 'active'
  `).all() as Record<string, unknown>[];

  return rows.map((row) => ({
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
  const db = openDatabase();
  const row = db.prepare(`
    SELECT
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
    WHERE l.slug = ? AND l.status = 'active'
    LIMIT 1
  `).get(slug) as Record<string, unknown> | undefined;
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
    favoriteSlugs: parseJsonArray<string>(String(row.favorite_slugs_json)),
    createdAt: String(row.user_created_at),
    updatedAt: String(row.user_updated_at),
  };

  const versionRows = db.prepare(`
    SELECT *
    FROM lobster_versions_mirror
    WHERE lobster_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
  `).all(lobster.id) as Record<string, unknown>[];

  return {
    lobster,
    owner,
    versions: versionRows.map(toMirrorVersion),
  };
}

export async function readMirroredLobsterVersion(slug: string, version: string, includeHidden = false) {
  await ensureDatabase();
  const db = openDatabase();
  const row = db.prepare(`
    SELECT
      l.*,
      lv.*
    FROM lobsters_mirror l
    JOIN lobster_versions_mirror lv ON lv.lobster_id = l.id
    WHERE l.slug = ? AND lv.version = ? ${includeHidden ? "" : "AND l.status = 'active'"}
    LIMIT 1
  `).get(slug, version) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    lobster: toMirrorLobster(row),
    version: toMirrorVersion(row),
  };
}

export async function readMirroredComments(slug: string) {
  await ensureDatabase();
  const db = openDatabase();
  const lobsterRow = db.prepare(`
    SELECT id
    FROM lobsters_mirror
    WHERE slug = ?
    LIMIT 1
  `).get(slug) as { id: number } | undefined;
  if (!lobsterRow) return null;

  const rows = db.prepare(`
    SELECT
      c.*,
      u.handle,
      u.display_name
    FROM comments_mirror c
    JOIN users_mirror u ON u.id = c.user_id
    WHERE c.lobster_id = ?
    ORDER BY datetime(c.created_at) ASC, c.id ASC
  `).all(lobsterRow.id) as Record<string, unknown>[];

  return rows.map((row) => ({
    comment: toMirrorComment(row),
    userHandle: String(row.handle),
    userDisplayName: row.display_name == null ? null : String(row.display_name),
  }));
}
