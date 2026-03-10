import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { DbState } from "./types";

const dataDir = path.resolve(process.env.CLAWLODGE_DATA_DIR || path.join(process.cwd(), "data"));
const dbFilePath = process.env.CLAWLODGE_DB_PATH
  ? path.resolve(process.env.CLAWLODGE_DB_PATH)
  : path.join(dataDir, "app.db");
const legacyJsonPath = path.join(dataDir, "app-db.json");

let ioChain: Promise<unknown> = Promise.resolve();
let database: DatabaseSync | null = null;
let initialized = false;

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
    `);
  }
  return database;
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
  db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1")
    .run(JSON.stringify(next), new Date().toISOString());
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
