import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

import { Pool } from "pg";

const DEFAULT_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_README_PROMPT_CHARS = 200;
const PROMPT_TIMEOUT_MS = 25000;
const IMAGE_TIMEOUT_MS = 45000;

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function readEnvFile(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {}
}

function getLlmApiKey() {
  return process.env.LLM_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim() || "";
}

function getLlmApiUrl() {
  return process.env.LLM_API_URL?.trim() || DEFAULT_CHAT_COMPLETIONS_URL;
}

function sanitizeReadmeExcerpt(readmeText = "") {
  return readmeText
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_README_PROMPT_CHARS);
}

function hasPath(paths, prefix) {
  return paths.some((item) => item === prefix || item.startsWith(`${prefix}/`));
}

function buildImageDirection(signals) {
  const cues = [];
  if (hasPath(signals.workspacePaths, "skills")) cues.push("skillful");
  if (hasPath(signals.workspacePaths, "memory")) cues.push("memory-oriented");
  if (hasPath(signals.workspacePaths, "workflows")) cues.push("workflow-heavy");
  if (hasPath(signals.workspacePaths, "docs")) cues.push("documentation-rich");
  if (hasPath(signals.workspacePaths, "devops")) cues.push("infrastructure-flavored");
  if (!cues.length) cues.push("general-purpose");
  return cues.join(", ");
}

async function generateIconPrompt(signals) {
  const apiKey = getLlmApiKey();
  if (!apiKey) throw new Error("Missing LLM_API_KEY / OPENROUTER_API_KEY");

  const readmeExcerpt = sanitizeReadmeExcerpt(signals.readmeText);
  const response = await fetch(getLlmApiUrl(), {
    method: "POST",
    signal: AbortSignal.timeout(PROMPT_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
      "X-Title": "ClawLodge",
    },
    body: JSON.stringify({
      model: process.env.CLAWLODGE_ICON_PROMPT_MODEL?.trim() || "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You write one concise image-generation prompt for a square UI icon. Return plain text only. The subject must always be a single lobster mascot. Emphasize silhouette, personality, and workspace-specific props or mood. Keep it under 90 words. No markdown.",
        },
        {
          role: "user",
          content: [
            `Workspace slug: ${signals.slug}`,
            `Version: ${signals.version}`,
            `Source type: ${signals.sourceType}`,
            `Tags: ${signals.tags.join(", ") || "none"}`,
            `Workspace shape: ${buildImageDirection(signals)}`,
            signals.summary ? `Summary: ${signals.summary}` : "",
            readmeExcerpt ? `README excerpt: ${readmeExcerpt}` : "",
            "",
            "Write a prompt for a distinct square icon: one stylized lobster, transparent or clean plain background, suitable for a product card, crisp edges, readable at small size, bold silhouette, no text. Target a compact 256x256 app-icon source image.",
          ].filter(Boolean).join("\n"),
        },
      ],
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.detail || `Prompt generation failed: ${response.status}`);
  }

  const prompt = typeof body?.choices?.[0]?.message?.content === "string"
    ? body.choices[0].message.content.replace(/\s+/g, " ").trim()
    : "";
  if (!prompt) throw new Error("Prompt generation returned empty content");
  return prompt;
}

function parseDataUrl(value) {
  const match = value.match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1] || "application/octet-stream",
    body: Buffer.from(match[2], "base64"),
  };
}

function asRecord(value) {
  return typeof value === "object" && value !== null ? value : null;
}

function toDataUrl(base64Value, mimeType = "image/png") {
  const cleaned = base64Value.replace(/\s+/g, "").trim();
  if (cleaned.length < 64) return null;
  return `data:${mimeType};base64,${cleaned}`;
}

function isAbsoluteAssetUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "data:";
  } catch {
    return false;
  }
}

function extractUrlFromText(text) {
  const normalized = text.trim();
  if (!normalized) return null;
  const dataUrlMatch = normalized.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
  if (dataUrlMatch?.[0] && isAbsoluteAssetUrl(dataUrlMatch[0])) return dataUrlMatch[0];
  const urlMatch = normalized.match(/https?:\/\/\S+/i)?.[0];
  if (urlMatch && isAbsoluteAssetUrl(urlMatch)) return urlMatch;
  return null;
}

function extractAssetCandidate(value) {
  if (typeof value === "string") {
    if (isAbsoluteAssetUrl(value)) return value;
    return extractUrlFromText(value);
  }

  const record = asRecord(value);
  if (!record) return null;

  const imageUrlField = record.image_url;
  if (typeof imageUrlField === "string" && isAbsoluteAssetUrl(imageUrlField)) return imageUrlField;
  const imageUrlObj = asRecord(imageUrlField);
  if (typeof imageUrlObj?.url === "string" && isAbsoluteAssetUrl(imageUrlObj.url)) return imageUrlObj.url;

  const camelImageUrl = asRecord(record.imageUrl);
  if (typeof camelImageUrl?.url === "string" && isAbsoluteAssetUrl(camelImageUrl.url)) return camelImageUrl.url;
  if (typeof record.url === "string" && isAbsoluteAssetUrl(record.url)) return record.url;
  if (typeof record.asset_url === "string" && isAbsoluteAssetUrl(record.asset_url)) return record.asset_url;
  if (typeof record.b64_json === "string") return toDataUrl(record.b64_json, typeof record.mime_type === "string" ? record.mime_type : "image/png");
  if (typeof record.base64 === "string") return toDataUrl(record.base64, typeof record.mime_type === "string" ? record.mime_type : "image/png");

  const inlineData = asRecord(record.inlineData);
  if (typeof inlineData?.data === "string") {
    return toDataUrl(inlineData.data, typeof inlineData.mimeType === "string" ? inlineData.mimeType : "image/png");
  }

  if (typeof record.text === "string") return extractUrlFromText(record.text);
  return null;
}

async function resolveRemoteAsset(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch generated asset: ${response.status}`);
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

async function parseImageAsset(body) {
  const payload = asRecord(body) ?? {};
  const candidates = [];

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = asRecord(choices[0]) ?? {};
  const firstMessage = asRecord(firstChoice.message) ?? {};

  if (Array.isArray(firstMessage.images)) {
    for (const item of firstMessage.images) {
      const candidate = extractAssetCandidate(item);
      if (candidate) candidates.push(candidate);
    }
  }

  const messageContent = firstMessage.content;
  if (Array.isArray(messageContent)) {
    for (const item of messageContent) {
      const candidate = extractAssetCandidate(item);
      if (candidate) candidates.push(candidate);
    }
  } else {
    const candidate = extractAssetCandidate(messageContent);
    if (candidate) candidates.push(candidate);
  }

  for (const bucket of [payload.data, payload.images]) {
    if (Array.isArray(bucket)) {
      for (const item of bucket) {
        const candidate = extractAssetCandidate(item);
        if (candidate) candidates.push(candidate);
      }
    } else {
      const candidate = extractAssetCandidate(bucket);
      if (candidate) candidates.push(candidate);
    }
  }

  for (const candidate of candidates) {
    const dataUrl = parseDataUrl(candidate);
    if (dataUrl) return dataUrl;
    if (isAbsoluteAssetUrl(candidate)) return resolveRemoteAsset(candidate);
  }

  throw new Error("Image response did not include a usable asset");
}

function iconExtensionForContentType(contentType) {
  const normalized = String(contentType).toLowerCase();
  if (normalized.includes("image/svg+xml")) return "svg";
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/jpeg")) return "jpg";
  if (normalized.includes("image/gif")) return "gif";
  return "bin";
}

function needsRasterNormalization(contentType) {
  const value = String(contentType).toLowerCase();
  return value.includes("image/png") || value.includes("image/webp") || value.includes("image/jpeg");
}

function normalizeRasterIcon(filePath) {
  execFileSync("magick", [
    filePath,
    "-fill", "white",
    "-draw", "color 1,1 floodfill",
    "-resize", "256x256!",
    filePath,
  ]);
}

async function renderIcon(prompt) {
  const apiKey = getLlmApiKey();
  if (!apiKey) throw new Error("Missing LLM_API_KEY / OPENROUTER_API_KEY");

  const response = await fetch(getLlmApiUrl(), {
    method: "POST",
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
      "X-Title": "ClawLodge",
    },
    body: JSON.stringify({
      model: process.env.CLAWLODGE_ICON_IMAGE_MODEL?.trim() || process.env.NANO_BANANA_MODEL?.trim() || "google/gemini-3.1-flash-image-preview",
      stream: false,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            prompt,
            "Format: square 1:1 icon.",
            "Target size: a compact 256x256 source image intended for 56px, 84px, and 112px UI rendering.",
            "Background: solid white background only.",
            "Output: one polished lobster icon only.",
            "Do not render any text or letters.",
          ].join("\n"),
        },
      ],
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.detail || `Image generation failed: ${response.status}`);
  }

  return parseImageAsset(body);
}

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) throw new Error("DATABASE_URL is required");
    pool = new Pool({ connectionString });
  }
  return pool;
}

async function loadLobsterSignals(slug) {
  const result = await getPool().query(
    `
      SELECT
        l.slug,
        l.summary,
        l.source_type,
        l.tags_json,
        lv.version,
        lv.readme_text,
        COALESCE(
          (
            SELECT json_agg(path ORDER BY path)
            FROM workspace_entries
            WHERE version_id = lv.id
          ),
          '[]'::json
        ) AS workspace_paths
      FROM lobsters_mirror l
      JOIN LATERAL (
        SELECT id, version, readme_text
        FROM lobster_versions_mirror
        WHERE lobster_id = l.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) lv ON TRUE
      WHERE l.slug = $1
      LIMIT 1
    `,
    [slug],
  );
  const row = result.rows[0];
  if (!row) throw new Error(`Lobster not found: ${slug}`);

  return {
    slug: String(row.slug),
    version: String(row.version),
    tags: Array.isArray(row.tags_json) ? row.tags_json : [],
    sourceType: String(row.source_type),
    workspacePaths: Array.isArray(row.workspace_paths) ? row.workspace_paths : [],
    readmeText: String(row.readme_text ?? ""),
    summary: String(row.summary ?? ""),
  };
}

export async function generateLobsterIconForSlug(slug) {
  await readEnvFile(path.resolve(".env.local"));
  const signals = await loadLobsterSignals(slug);

  const prompt = await generateIconPrompt(signals);

  const icon = await renderIcon(prompt);
  const extension = iconExtensionForContentType(icon.contentType);
  const outputDir = path.resolve("output/imagegen");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${slug}-icon-generated.${extension}`);
  const promptPath = path.join(outputDir, `${slug}-icon-generated.prompt.txt`);
  await fs.writeFile(outputPath, icon.body);
  await fs.writeFile(promptPath, `${prompt}\n`, "utf8");
  if (needsRasterNormalization(icon.contentType)) {
    normalizeRasterIcon(outputPath);
  }

  return {
    slug,
    version: signals.version,
    outputPath,
    promptPath,
    prompt,
    contentType: icon.contentType,
    seed: sha256(`${slug}:${signals.version}:${prompt}`),
  };
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: node scripts/generate-lobster-icon.mjs <slug>");
    process.exit(1);
  }

  const result = await generateLobsterIconForSlug(slug);
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
