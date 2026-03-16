#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import pg from "pg";

const DEFAULT_LOG_DIR = "/var/log/nginx";
const DEFAULT_DAYS = 7;

function parseArgs(argv) {
  const options = {
    days: DEFAULT_DAYS,
    logDir: DEFAULT_LOG_DIR,
    files: [],
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--days") {
      options.days = Number(argv[++index] ?? DEFAULT_DAYS);
      continue;
    }
    if (arg === "--log-dir") {
      options.logDir = argv[++index] ?? DEFAULT_LOG_DIR;
      continue;
    }
    if (arg === "--file") {
      options.files.push(argv[++index]);
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function resolveLogFiles({ logDir, files, days }) {
  if (files.length) return files;

  const resolved = [];
  for (let day = 0; day <= days; day += 1) {
    if (day === 0) {
      resolved.push(path.join(logDir, "access.log"));
    } else if (day === 1) {
      resolved.push(path.join(logDir, "access.log.1"));
    } else {
      resolved.push(path.join(logDir, `access.log.${day}.gz`));
    }
  }
  return resolved.filter((filePath) => fs.existsSync(filePath));
}

function createLineStream(filePath) {
  const source = fs.createReadStream(filePath);
  const stream = filePath.endsWith(".gz") ? source.pipe(zlib.createGunzip()) : source;
  return readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });
}

function parseLine(line) {
  const match = line.match(/^\S+ \S+ \S+ \[(?<time>[^\]]+)\] "(?<method>[A-Z]+) (?<path>\S+) HTTP\/[^"]+" (?<status>\d{3}) /);
  if (!match?.groups) return null;
  return {
    time: match.groups.time,
    method: match.groups.method,
    path: match.groups.path,
    status: Number(match.groups.status),
  };
}

function extractSlug(requestPath) {
  const cleanPath = requestPath.split("?")[0];
  const match = cleanPath.match(/^\/lobsters\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function collectCounts(filePaths) {
  const counts = new Map();

  for (const filePath of filePaths) {
    const lines = createLineStream(filePath);
    for await (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      if (parsed.method !== "GET" || parsed.status !== 200) continue;
      const slug = extractSlug(parsed.path);
      if (!slug) continue;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }

  return counts;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const filePaths = resolveLogFiles(options);

  if (!filePaths.length) {
    throw new Error("No nginx access logs found for backfill");
  }

  const counts = await collectCounts(filePaths);
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();
  let db;
  try {
    const result = await client.query("SELECT payload FROM app_state WHERE id = 1");
    const payload = result.rows[0]?.payload;
    if (!payload) {
      throw new Error("app_state payload not found");
    }
    db = typeof payload === "string" ? JSON.parse(payload) : payload;
  } finally {
    client.release();
    await pool.end();
  }

  const slugs = new Set(db.lobsters.map((lobster) => lobster.slug));
  const applicable = [...counts.entries()].filter(([slug]) => slugs.has(slug));

  if (!applicable.length) {
    console.log("No lobster detail-page hits found in the selected nginx logs.");
    return;
  }

  const summary = applicable
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([slug, count]) => `${slug}:${count}`)
    .join(", ");

  console.log(`Matched ${applicable.length} slugs from ${filePaths.length} log files.`);
  console.log(`Top counts: ${summary}`);

  if (options.dryRun) return;

  for (const lobster of db.lobsters) {
    const count = counts.get(lobster.slug);
    if (count == null) continue;
    lobster.viewCount = count;
  }

  const updatePool = new pg.Pool({ connectionString });
  const updateClient = await updatePool.connect();
  try {
    await updateClient.query("BEGIN");
    await updateClient.query(
      "UPDATE app_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1",
      [JSON.stringify(db)],
    );
    for (const [slug, count] of applicable) {
      await updateClient.query(
        "UPDATE lobsters_mirror SET view_count = $2, updated_at = NOW() WHERE slug = $1",
        [slug, count],
      );
    }
    await updateClient.query("COMMIT");
  } catch (error) {
    await updateClient.query("ROLLBACK");
    throw error;
  } finally {
    updateClient.release();
    await updatePool.end();
  }

  console.log("Backfill complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
