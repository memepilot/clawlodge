import fs from "node:fs/promises";
import path from "node:path";

import { ApiError } from "./errors";

const dataDir = path.resolve(process.env.CLAWLODGE_DATA_DIR || path.join(process.cwd(), "data"));
const storageDir = path.join(dataDir, "storage");
const storageMarker = `${storageDir}${path.sep}`;

function normalizeKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new ApiError(400, "Invalid storage key");
  }
  return normalized;
}

function metaPathFor(fullPath: string) {
  return `${fullPath}.meta.json`;
}

function inferContentType(key: string) {
  if (key.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (key.endsWith('.json')) return 'application/json; charset=utf-8';
  if (key.endsWith('.zip')) return 'application/zip';
  if (key.endsWith('.txt')) return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

export function toStorageUrl(key: string) {
  const normalized = normalizeKey(key);
  return `/api/v1/storage/${normalized.split('/').map(encodeURIComponent).join('/')}`;
}

export function resolvePublicAssetUrl(input: string | null | undefined) {
  if (!input) return null;
  if (input.startsWith('/api/v1/storage/')) {
    return input;
  }
  if (input.startsWith('file://')) {
    const withoutScheme = decodeURIComponent(input.slice('file://'.length).split('?')[0]);
    const markerIndex = withoutScheme.indexOf(storageMarker);
    if (markerIndex >= 0) {
      return toStorageUrl(withoutScheme.slice(markerIndex + storageMarker.length));
    }
  }
  return input;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  const normalized = normalizeKey(key);
  const fullPath = path.join(storageDir, normalized);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
  await fs.writeFile(metaPathFor(fullPath), JSON.stringify({ contentType }, null, 2), 'utf8');
  return toStorageUrl(normalized);
}

export async function getStoredObject(key: string) {
  const normalized = normalizeKey(key);
  const fullPath = path.join(storageDir, normalized);
  if (!fullPath.startsWith(storageDir)) {
    throw new ApiError(400, 'Invalid storage key');
  }

  try {
    const [body, metaRaw, stats] = await Promise.all([
      fs.readFile(fullPath),
      fs.readFile(metaPathFor(fullPath), 'utf8').catch(() => null),
      fs.stat(fullPath),
    ]);
    const meta = metaRaw ? (JSON.parse(metaRaw) as { contentType?: string }) : null;
    return {
      body,
      contentType: meta?.contentType || inferContentType(normalized),
      filename: path.basename(normalized),
      size: stats.size,
      lastModified: stats.mtime.toUTCString(),
    };
  } catch {
    throw new ApiError(404, 'Stored object not found');
  }
}
