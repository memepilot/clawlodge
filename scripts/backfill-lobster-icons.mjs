import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { DatabaseSync } from "node:sqlite";

import { generateLobsterIconForSlug } from "./generate-lobster-icon.mjs";

function toStorageUrl(key) {
  return `/api/v1/storage/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizeKey(key) {
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

function metaPathFor(fullPath) {
  return `${fullPath}.meta.json`;
}

function contentTypeToExt(contentType) {
  const value = String(contentType).toLowerCase();
  if (value.includes("image/svg+xml")) return "svg";
  if (value.includes("image/png")) return "png";
  if (value.includes("image/webp")) return "webp";
  if (value.includes("image/jpeg")) return "jpg";
  if (value.includes("image/gif")) return "gif";
  return "bin";
}

function contentTypeFromExtension(extension) {
  switch (extension) {
    case "svg":
      return "image/svg+xml";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function getLatestVersions(state) {
  const latestByLobster = new Map();
  for (const version of state.lobsterVersions ?? []) {
    const current = latestByLobster.get(version.lobsterId);
    if (!current || String(version.createdAt || "") > String(current.createdAt || "")) {
      latestByLobster.set(version.lobsterId, version);
    }
  }
  return latestByLobster;
}

async function putLocalStorageObject(key, body, contentType) {
  const dataDir = path.resolve("data");
  const storageDir = path.join(dataDir, "storage");
  const normalized = normalizeKey(key);
  const fullPath = path.join(storageDir, normalized);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
  await fs.writeFile(metaPathFor(fullPath), JSON.stringify({ contentType }, null, 2), "utf8");
  return toStorageUrl(normalized);
}

async function findExistingGenerated(slug) {
  const outputDir = path.resolve("output/imagegen");
  for (const extension of ["png", "svg", "webp", "jpg", "gif"]) {
    const outputPath = path.join(outputDir, `${slug}-icon-generated.${extension}`);
    if (existsSync(outputPath)) {
      const promptPath = path.join(outputDir, `${slug}-icon-generated.prompt.txt`);
      const prompt = existsSync(promptPath) ? (await fs.readFile(promptPath, "utf8")).trim() : null;
      return {
        outputPath,
        promptPath: existsSync(promptPath) ? promptPath : null,
        prompt,
        contentType: contentTypeFromExtension(extension),
      };
    }
  }
  return null;
}

async function main() {
  const dbPath = path.resolve("data/app.db");
  const db = new DatabaseSync(dbPath);
  const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get();
  if (!row?.payload) {
    throw new Error("Missing app_state payload");
  }

  const state = JSON.parse(row.payload);
  const latestVersions = getLatestVersions(state);
  const results = [];
  const failures = [];
  let index = 0;

  for (const lobster of state.lobsters ?? []) {
    const latest = latestVersions.get(lobster.id);
    if (!latest) continue;
    index += 1;
    console.log(`[${index}/${state.lobsters.length}] ${lobster.slug}`);

    if (latest.iconSpecVersion === "nanobana-v1" && latest.iconUrl) {
      console.log(`skip: ${lobster.slug} already backfilled`);
      continue;
    }

    try {
      const reused = await findExistingGenerated(lobster.slug);
      const generated = reused ?? await generateLobsterIconForSlug(lobster.slug);
      const extension = contentTypeToExt(generated.contentType);
      const targetKey = `lobsters/${lobster.slug}/${latest.version}/icon.${extension}`;
      const outputBuffer = await fs.readFile(generated.outputPath);
      const iconUrl = await putLocalStorageObject(targetKey, outputBuffer, generated.contentType);

      latest.iconUrl = iconUrl;
      latest.iconSeed = generated.seed ?? null;
      latest.iconSpecVersion = "nanobana-v1";

      results.push({
        slug: lobster.slug,
        version: latest.version,
        iconUrl,
        iconSeed: generated.seed ?? null,
        iconSpecVersion: "nanobana-v1",
        prompt: generated.prompt ?? null,
        outputPath: generated.outputPath,
      });

      db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1")
        .run(JSON.stringify(state), new Date().toISOString());
    } catch (error) {
      failures.push({
        slug: lobster.slug,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`failed: ${lobster.slug}`, error instanceof Error ? error.message : String(error));
    }
  }

  const outputDir = path.resolve("output/imagegen");
  await fs.mkdir(outputDir, { recursive: true });
  const mappingPath = path.join(outputDir, "lobster-icon-backfill.json");
  await fs.writeFile(mappingPath, JSON.stringify(results, null, 2), "utf8");
  const failuresPath = path.join(outputDir, "lobster-icon-backfill.failures.json");
  await fs.writeFile(failuresPath, JSON.stringify(failures, null, 2), "utf8");

  console.log(JSON.stringify({
    count: results.length,
    mappingPath,
    failuresPath,
    failed: failures.length,
    first: results[0] ?? null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
