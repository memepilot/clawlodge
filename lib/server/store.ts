import fs from "node:fs/promises";
import path from "node:path";

import { DbState } from "./types";

const dataDir = path.resolve(process.env.CLAWLODGE_DATA_DIR || path.join(process.cwd(), "data"));
const dbPath = path.join(dataDir, "app-db.json");

let writeChain = Promise.resolve();

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

async function ensureDbFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(emptyState(), null, 2), "utf8");
  }
}

export async function readDb(): Promise<DbState> {
  await ensureDbFile();
  const raw = await fs.readFile(dbPath, "utf8");
  const parsed = JSON.parse(raw) as DbState;
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

export async function writeDb(next: DbState) {
  await ensureDbFile();
  writeChain = writeChain.then(() => fs.writeFile(dbPath, JSON.stringify(next, null, 2), "utf8"));
  await writeChain;
}

export async function mutateDb<T>(fn: (state: DbState) => T | Promise<T>): Promise<T> {
  const state = await readDb();
  const result = await fn(state);
  await writeDb(state);
  return result;
}
