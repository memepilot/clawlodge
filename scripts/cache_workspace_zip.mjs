import fs from "node:fs/promises";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import pg from "pg";

const [, , slug, version] = process.argv;

if (!slug || !version) {
  console.error("Usage: node scripts/cache_workspace_zip.mjs <slug> <version>");
  process.exit(1);
}

const dataDir = path.resolve(process.env.CLAWLODGE_DATA_DIR || path.join(process.cwd(), "data"));
const storageDir = path.join(dataDir, "storage");
const ZIP_FETCH_CONCURRENCY = 12;

function normalizeKey(key) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) throw new Error(`Invalid storage key: ${key}`);
  return normalized;
}

function storagePathForKey(key) {
  return path.join(storageDir, normalizeKey(key));
}

async function getStoredObjectByKey(key) {
  const fullPath = storagePathForKey(key);
  return fs.readFile(fullPath);
}

async function putStoredObjectByKey(key, body, contentType) {
  const fullPath = storagePathForKey(key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
  await fs.writeFile(`${fullPath}.meta.json`, JSON.stringify({ contentType }, null, 2), "utf8");
}

function decodeStorageKeyFromUrl(url) {
  if (!url?.startsWith("/api/v1/storage/")) return null;
  const encoded = url.slice("/api/v1/storage/".length);
  return encoded
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");
}

function workspaceZipStorageKey(slugValue, versionValue) {
  return `lobsters/${slugValue}/${versionValue}/workspace.zip`;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

function toGithubRawAssetUrl(assetUrl, repo, ref) {
  if (assetUrl && !/^(?:[a-z]+:)?\/\//i.test(assetUrl) && !assetUrl.startsWith("#") && !assetUrl.startsWith("data:")) {
    const cleanPath = assetUrl.split("#")[0].split("?")[0];
    const normalized = path.posix.normalize(cleanPath).replace(/^(\.\.\/)+/, "").replace(/^\.?\//, "");
    if (!normalized) return null;
    return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${encodeURIComponent(ref)}/${normalized
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }
  return null;
}

function parseGithubRepoRef(sourceRepo) {
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

async function fetchGithubRawWorkspaceFile({ sourceRepo, sourceCommit, filePath }) {
  const repo = parseGithubRepoRef(sourceRepo);
  if (!repo || !sourceCommit) return null;
  const rawUrl = toGithubRawAssetUrl(filePath, repo, sourceCommit);
  if (!rawUrl) return null;
  const response = await fetch(rawUrl, {
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": "ClawLodge",
    },
  });
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  const envFile = process.env.DATABASE_URL
    ? null
    : await fs.readFile(path.join(process.cwd(), ".env.production"), "utf8");
  const connectionString = process.env.DATABASE_URL || envFile.match(/^DATABASE_URL=(.*)$/m)?.[1];
  if (!connectionString) throw new Error("DATABASE_URL not found");

  const pool = new pg.Pool({ connectionString });
  try {
    const result = await pool.query(
      `SELECT
         l.slug,
         l.name,
         l.summary,
         l.license,
         v.version,
         v.readme_text,
         v.source_repo,
         v.source_commit,
         v.publish_client,
         v.skills_bundle_url,
         s.workspace_files_json
       FROM lobster_versions_mirror v
       JOIN lobsters_mirror l ON l.id = v.lobster_id
       LEFT JOIN (
         SELECT version_id, json_agg(json_build_object(
           'path', path,
           'size', size,
           'kind', kind,
           'content_text', content_text,
           'storage_url', storage_url,
           'content_excerpt', content_excerpt,
           'masked_count', masked_count
         ) ORDER BY path ASC) AS workspace_files_json
         FROM workspace_entries
         GROUP BY version_id
       ) s ON s.version_id = v.id
       WHERE l.slug = $1 AND v.version = $2
       LIMIT 1`,
      [slug, version],
    );
    const row = result.rows[0];
    if (!row) throw new Error(`Version not found: ${slug}@${version}`);

    const files = row.workspace_files_json ?? [];
    const root = `${row.slug}-${row.version}`;
    const entries = {};
    const unrecoverable = [];

    entries[`${root}/README.md`] = strToU8(row.readme_text || "");
    entries[`${root}/manifest.json`] = strToU8(
      JSON.stringify(
        {
          schema_version: "1.0",
          lobster_slug: row.slug,
          version: row.version,
          name: row.name,
          summary: row.summary,
          license: row.license,
          readme_path: "README.md",
          source: {
            repo_url: row.source_repo,
            commit: row.source_commit,
          },
          publish_client: row.publish_client,
        },
        null,
        2,
      ),
    );

    const fileResults = await mapWithConcurrency(files, ZIP_FETCH_CONCURRENCY, async (file) => {
      if (file.path === "README.md") {
        return { path: file.path, body: null, missing: false };
      }
      if (file.kind === "text" && file.content_text) {
        return { path: file.path, body: strToU8(file.content_text), missing: false };
      }

      const storedKey = decodeStorageKeyFromUrl(file.storage_url);
      if (storedKey) {
        try {
          const body = await getStoredObjectByKey(storedKey);
          return { path: file.path, body: new Uint8Array(body), missing: false };
        } catch {}
      }

      const githubRaw = await fetchGithubRawWorkspaceFile({
        sourceRepo: row.source_repo,
        sourceCommit: row.source_commit,
        filePath: file.path,
      });
      if (githubRaw) {
        return { path: file.path, body: new Uint8Array(githubRaw), missing: false };
      }

      return { path: file.path, body: null, missing: true };
    });

    for (const item of fileResults) {
      if (item.path === "README.md") continue;
      if (item.body) {
        entries[`${root}/${item.path}`] = item.body;
        continue;
      }
      if (item.missing) {
        unrecoverable.push(item.path);
      }
    }

    const skillsBundleKey = decodeStorageKeyFromUrl(row.skills_bundle_url);
    if (skillsBundleKey) {
      try {
        const body = await getStoredObjectByKey(skillsBundleKey);
        entries[`${root}/skills_bundle.zip`] = new Uint8Array(body);
      } catch {}
    }

    if (unrecoverable.length) {
      entries[`${root}/EXPORT_NOTES.md`] = strToU8(
        ["# Export Notes", "", "Missing files:", "", ...unrecoverable.map((filePath) => `- \`${filePath}\``)].join("\n"),
      );
    }

    const body = Buffer.from(zipSync(entries, { level: 6 }));
    const key = workspaceZipStorageKey(slug, version);
    await putStoredObjectByKey(key, body, "application/zip");
    console.log(JSON.stringify({ slug, version, key, size: body.byteLength, missing: unrecoverable.length }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
