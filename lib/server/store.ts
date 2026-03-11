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
    category: lobster.category ?? null,
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

function versionsWithInlineWorkspaceFiles(state: DbState) {
  return state.lobsterVersions.filter((version) => Array.isArray(version.workspaceFiles));
}

function stripWorkspaceFilesFromState(state: DbState): DbState {
  return {
    ...state,
    lobsterVersions: state.lobsterVersions.map((version) => ({
      ...version,
      workspaceFiles: undefined,
    })),
  };
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
      PRAGMA busy_timeout = 5000;
    `);
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
        category TEXT,
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
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lobsters_mirror_status_slug ON lobsters_mirror(status, slug);
      CREATE INDEX IF NOT EXISTS idx_lobsters_mirror_owner ON lobsters_mirror(owner_id);
      CREATE INDEX IF NOT EXISTS idx_versions_mirror_lobster_created ON lobster_versions_mirror(lobster_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workspace_entries_version_path ON workspace_entries(version_id, path);
      CREATE INDEX IF NOT EXISTS idx_comments_mirror_lobster_created ON comments_mirror(lobster_id, created_at ASC);
    `);
    const lobsterColumns = database.prepare("PRAGMA table_info(lobsters_mirror)").all() as Array<{ name: string }>;
    if (!lobsterColumns.some((column) => column.name === "category")) {
      database.exec("ALTER TABLE lobsters_mirror ADD COLUMN category TEXT;");
    }
  }
  return database;
}

function syncWorkspaceEntries(db: DatabaseSync, state: DbState) {
  const versions = versionsWithInlineWorkspaceFiles(state);
  if (!versions.length) return;

  const deleteEntries = db.prepare(`DELETE FROM workspace_entries WHERE version_id = ?`);
  const insertEntry = db.prepare(`
    INSERT INTO workspace_entries (
      version_id, path, size, kind, content_excerpt, content_text, content_type, storage_url, masked_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const version of versions) {
    deleteEntries.run(version.id);
    for (const file of version.workspaceFiles ?? []) {
      insertEntry.run(
        version.id,
        file.path,
        file.size,
        file.kind,
        file.contentExcerpt ?? null,
        file.contentText ?? null,
        file.contentType ?? null,
        file.storageUrl ?? null,
        file.maskedCount ?? 0,
      );
    }
  }
}

function workspaceEntriesCount(db: DatabaseSync) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM workspace_entries").get() as { count: number };
  return Number(row.count || 0);
}

function backfillWorkspaceEntriesFromMirrorJson(db: DatabaseSync) {
  const rows = db.prepare(`
    SELECT id, workspace_files_json
    FROM lobster_versions_mirror
    WHERE workspace_files_json IS NOT NULL AND workspace_files_json != '[]'
  `).all() as Array<{ id: number; workspace_files_json: string }>;
  if (!rows.length) return;

  const insertEntry = db.prepare(`
    INSERT INTO workspace_entries (
      version_id, path, size, kind, content_excerpt, content_text, content_type, storage_url, masked_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of rows) {
    const files = parseJsonArray<DbWorkspaceFile>(row.workspace_files_json);
    for (const file of files) {
      insertEntry.run(
        row.id,
        file.path,
        file.size,
        file.kind,
        file.contentExcerpt ?? null,
        file.contentText ?? null,
        file.contentType ?? null,
        file.storageUrl ?? null,
        file.maskedCount ?? 0,
      );
    }
  }
}

function syncMirrorTables(db: DatabaseSync, state: DbState) {
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
      user.displayName ?? null,
      user.avatarUrl ?? null,
      user.bio ?? null,
      user.email ?? null,
      user.githubId ?? null,
      JSON.stringify(user.favoriteSlugs ?? []),
      user.createdAt,
      user.updatedAt,
    );
  }

  const insertLobster = db.prepare(`
    INSERT INTO lobsters_mirror (
      id, slug, owner_id, name, summary, category, license, source_type, source_url, original_author, verified,
      curation_note, seeded_at, status, report_penalty, search_document, tags_json, recommendation_score,
      github_stars, favorite_count, download_count, share_count, comment_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const lobster of state.lobsters) {
    insertLobster.run(
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
      lobster.verified ? 1 : 0,
      lobster.curationNote ?? null,
      lobster.seededAt ?? null,
      lobster.status,
      lobster.reportPenalty,
      lobster.searchDocument ?? "",
      JSON.stringify(lobster.tags ?? []),
      lobster.recommendationScore ?? null,
      lobster.githubStars ?? null,
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
      version.skillsBundleUrl ?? null,
      version.iconUrl ?? null,
      version.iconSeed ?? null,
      version.iconSpecVersion ?? null,
      version.sourceRepo ?? null,
      version.sourceCommit ?? null,
      "[]",
      version.publishClient ?? null,
      version.maskedSecretsCount,
      version.blockedFilesCount,
      JSON.stringify(version.skills ?? []),
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
    const persisted = stripWorkspaceFilesFromState(state);
    db.exec("BEGIN IMMEDIATE");
    try {
      syncWorkspaceEntries(db, state);
      db.prepare("INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?)")
        .run(JSON.stringify(persisted), new Date().toISOString());
      syncMirrorTables(db, persisted);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } else {
    const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get() as { payload: string };
    const state = normalizeState(JSON.parse(row.payload) as DbState);
    const persisted = stripWorkspaceFilesFromState(state);
    db.exec("BEGIN IMMEDIATE");
    try {
      if (workspaceEntriesCount(db) === 0) {
        syncWorkspaceEntries(db, state);
        if (workspaceEntriesCount(db) === 0) {
          backfillWorkspaceEntriesFromMirrorJson(db);
        }
      } else {
        syncWorkspaceEntries(db, state);
      }
      if (versionsWithInlineWorkspaceFiles(state).length) {
        db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1")
          .run(JSON.stringify(persisted), new Date().toISOString());
      }
      syncMirrorTables(db, persisted);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
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
  const persisted = stripWorkspaceFilesFromState(next);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1")
      .run(JSON.stringify(persisted), now);
    syncWorkspaceEntries(db, next);
    syncMirrorTables(db, persisted);
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

  const versions = versionRows.map(toMirrorVersion);
  const workspaceEntryRows = versions.length
    ? db.prepare(`
      SELECT *
      FROM workspace_entries
      WHERE version_id IN (${versions.map(() => "?").join(",")})
      ORDER BY path ASC
    `).all(...versions.map((version) => version.id)) as Record<string, unknown>[]
    : [];
  const filesByVersionId = new Map<number, DbWorkspaceFile[]>();
  for (const rowEntry of workspaceEntryRows) {
    const versionId = Number(rowEntry.version_id);
    const bucket = filesByVersionId.get(versionId) ?? [];
    bucket.push({
      path: String(rowEntry.path),
      size: Number(rowEntry.size),
      kind: rowEntry.kind as DbWorkspaceFile["kind"],
      contentExcerpt: rowEntry.content_excerpt == null ? null : String(rowEntry.content_excerpt),
      contentText: rowEntry.content_text == null ? null : String(rowEntry.content_text),
      contentType: rowEntry.content_type == null ? null : String(rowEntry.content_type),
      storageUrl: rowEntry.storage_url == null ? null : String(rowEntry.storage_url),
      maskedCount: Number(rowEntry.masked_count),
    });
    filesByVersionId.set(versionId, bucket);
  }
  for (const version of versions) {
    version.workspaceFiles = filesByVersionId.get(version.id) ?? [];
  }

  return {
    lobster,
    owner,
    versions,
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
  const mirroredVersion = toMirrorVersion(row);
  const workspaceEntryRows = db.prepare(`
    SELECT *
    FROM workspace_entries
    WHERE version_id = ?
    ORDER BY path ASC
  `).all(mirroredVersion.id) as Record<string, unknown>[];
  mirroredVersion.workspaceFiles = workspaceEntryRows.map((entry) => ({
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
  const db = openDatabase();
  const rows = db.prepare(`
    SELECT *
    FROM workspace_entries
    WHERE version_id = ?
    ORDER BY path ASC
  `).all(versionId) as Record<string, unknown>[];
  return rows.map((entry) => ({
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
