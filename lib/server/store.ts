import fs from "node:fs/promises";
import path from "node:path";

import { seededState } from "./storeSeed";
import { DbState } from "./types";

const dataDir = path.resolve(process.cwd(), "data");
const dbPath = path.join(dataDir, "app-db.json");

let writeChain = Promise.resolve();

async function ensureDbFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(seededState(), null, 2), "utf8");
  }
}

export async function readDb(): Promise<DbState> {
  await ensureDbFile();
  const raw = await fs.readFile(dbPath, "utf8");
  const parsed = JSON.parse(raw) as DbState;
  parsed.lobsterVersions = parsed.lobsterVersions.map((version) => ({
    ...version,
    workspaceFiles: (version.workspaceFiles ?? []).map((file) => ({
      ...file,
      contentText: file.contentText ?? null,
      maskedCount: file.maskedCount ?? 0,
    })),
    publishClient: version.publishClient ?? null,
    maskedSecretsCount: version.maskedSecretsCount ?? 0,
    blockedFilesCount: version.blockedFilesCount ?? 0,
  }));
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
