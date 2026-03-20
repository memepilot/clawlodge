#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { Pool } from "pg";

const DEFAULT_MODEL = "openai/gpt-4.1";
const DEFAULT_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_README_CHARS = 6000;
const ALLOWED_TOPICS = ["dev", "design", "research", "writing", "productivity", "multiagent", "automation"];

function parseArgs(argv) {
  const args = {
    limit: 0,
    dryRun: false,
    slugs: [],
    output: "output/topics-backfill-results.json",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--limit") {
      args.limit = Number(argv[index + 1] || 0);
      index += 1;
    } else if (arg === "--slug") {
      args.slugs.push(String(argv[index + 1] || "").trim());
      index += 1;
    } else if (arg === "--output") {
      args.output = String(argv[index + 1] || args.output);
      index += 1;
    }
  }

  return args;
}

async function loadDotenv(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore missing dotenv
  }
}

function excerptReadme(readmeText) {
  const normalized = String(readmeText || "").trim();
  if (!normalized) return "";
  return normalized.slice(0, MAX_README_CHARS);
}

function normalizeTopics(value) {
  const seen = new Set();
  const normalized = [];
  for (const topic of value) {
    const clean = String(topic || "").trim().toLowerCase();
    if (!ALLOWED_TOPICS.includes(clean) || seen.has(clean)) continue;
    seen.add(clean);
    normalized.push(clean);
  }
  return normalized.slice(0, 3);
}

function buildSearchDocument(item) {
  return [
    item.slug,
    item.slug.replace(/-/g, " "),
    item.name,
    item.summary || "",
    (item.tags || []).join(" "),
    (item.topics || []).join(" "),
    item.source_url || "",
    item.original_author || "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callOpenRouter(payload) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required");
  }

  const response = await fetch(DEFAULT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
      "X-Title": "ClawLodge",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.detail || `OpenRouter request failed: ${response.status}`);
  }
  return body;
}

async function classifyTopics(item) {
  const payload = {
    model: process.env.CLAWLODGE_TOPICS_MODEL?.trim() || DEFAULT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You classify OpenClaw marketplace assets for search and discovery.",
          "Return JSON only with a single key: topics.",
          `topics must be an array of 1 to 3 values chosen only from: ${ALLOWED_TOPICS.join(", ")}.`,
          "These are orthogonal use-case topics, not asset types.",
          "Do not repeat the category as a topic. For example, if category is memory, do not invent a memory topic.",
          "Choose topics based on the repo's primary practical use cases, user intent, and outputs.",
          "Prefer 1 or 2 topics. Use a 3rd topic only when it is clearly central to the asset.",
          "For single-purpose skills or narrowly scoped assets, prefer a single strongest topic.",
          "Use multiagent only when the repo explicitly centers on multiple collaborating agents, orchestration, dispatch, or role-based agent teams.",
          "Do not use multiagent for ordinary skills, memory helpers, personal workspaces, or solo automation.",
          "Do not add productivity or automation as filler topics unless those workflows are a primary user-facing value.",
          "Do not optimize for one keyword or one edge case; classify the overall asset.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Slug: ${item.slug}`,
          `Name: ${item.name}`,
          `Category: ${item.category || "(none)"}`,
          `Summary: ${item.summary || "(none)"}`,
          `Current tags: ${(item.tags || []).join(", ") || "(none)"}`,
          `Source repo: ${item.source_repo || item.source_url || "(none)"}`,
          `Original author: ${item.original_author || "(unknown)"}`,
          "",
          "README excerpt:",
          excerptReadme(item.readme_text),
        ].join("\n"),
      },
    ],
  };

  const body = await callOpenRouter(payload);
  const raw = body?.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(`Empty topics response for ${item.slug}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON topics response for ${item.slug}: ${raw.slice(0, 300)}`);
  }

  const topics = normalizeTopics(Array.isArray(parsed?.topics) ? parsed.topics : []);
  if (!topics.length) {
    throw new Error(`No valid topics returned for ${item.slug}`);
  }
  return topics;
}

async function fetchCandidates(pool, args) {
  const columnCheck = await pool.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'lobsters_mirror' AND column_name = 'topics_json'
      LIMIT 1
    `,
  );
  const hasTopicsColumn = columnCheck.rowCount > 0;
  const conditions = ["l.status = 'active'"];
  const params = [];

  if (args.slugs.length) {
    params.push(args.slugs);
    conditions.push(`l.slug = ANY($${params.length}::text[])`);
  }

  const result = await pool.query(
    `
      SELECT
        l.id,
        l.slug,
        l.name,
        l.summary,
        l.category,
        l.tags_json,
        ${hasTopicsColumn ? "l.topics_json" : "'[]'::jsonb AS topics_json"},
        l.source_url,
        l.original_author,
        lv.version,
        lv.readme_text,
        lv.source_repo
      FROM lobsters_mirror l
      LEFT JOIN LATERAL (
        SELECT version, readme_text, source_repo
        FROM lobster_versions_mirror
        WHERE lobster_id = l.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) lv ON TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY l.slug ASC
    `,
    params,
  );

  const rows = result.rows.map((row) => ({
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    summary: String(row.summary || ""),
    category: row.category == null ? null : String(row.category),
    tags: Array.isArray(row.tags_json) ? row.tags_json.map(String) : [],
    topics: Array.isArray(row.topics_json) ? row.topics_json.map(String) : [],
    source_url: row.source_url == null ? null : String(row.source_url),
    original_author: row.original_author == null ? null : String(row.original_author),
    version: row.version == null ? null : String(row.version),
    readme_text: row.readme_text == null ? "" : String(row.readme_text),
    source_repo: row.source_repo == null ? null : String(row.source_repo),
  }));

  return args.limit > 0 ? rows.slice(0, args.limit) : rows;
}

async function applyUpdates(pool, updates) {
  if (!updates.length) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const stateRow = await client.query("SELECT payload FROM app_state WHERE id = 1");
    const payload = stateRow.rows[0]?.payload;
    if (!payload) throw new Error("app_state not found");
    const state = typeof payload === "string" ? JSON.parse(payload) : payload;
    const bySlug = new Map(updates.map((update) => [update.slug, update]));

    for (const lobster of state.lobsters ?? []) {
      const update = bySlug.get(lobster.slug);
      if (!update) continue;
      lobster.topics = update.topics;
      lobster.searchDocument = update.search_document;
      lobster.updatedAt = update.updated_at;
    }

    await client.query(
      "UPDATE app_state SET payload = $1::jsonb, updated_at = $2 WHERE id = 1",
      [JSON.stringify(state), new Date().toISOString()],
    );

    for (const update of updates) {
      await client.query(
        `
          UPDATE lobsters_mirror
          SET topics_json = $1::jsonb,
              search_document = $2,
              updated_at = $3
          WHERE slug = $4
        `,
        [JSON.stringify(update.topics), update.search_document, update.updated_at, update.slug],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadDotenv(path.resolve(".env.local"));

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString,
    application_name: "clawlodge-backfill-topics",
    idle_in_transaction_session_timeout: 10_000,
  });
  try {
    const candidates = await fetchCandidates(pool, args);
    const updates = [];
    const results = [];
    const failures = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const item = candidates[index];
      try {
        const topics = await classifyTopics(item);
        const updatedAt = new Date().toISOString();
        const update = {
          slug: item.slug,
          topics,
          search_document: buildSearchDocument({
            slug: item.slug,
            name: item.name,
            summary: item.summary,
            tags: item.tags,
            topics,
            source_url: item.source_url,
            original_author: item.original_author,
          }),
          updated_at: updatedAt,
        };
        updates.push(update);
        results.push({
          slug: item.slug,
          category: item.category,
          before_topics: item.topics,
          after_topics: topics,
        });
        console.error(`[${index + 1}/${candidates.length}] ${item.slug} -> ${topics.join(", ")}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ slug: item.slug, error: message });
        console.error(`[${index + 1}/${candidates.length}] ${item.slug} FAILED: ${message}`);
      }
    }

    await fs.mkdir(path.dirname(args.output), { recursive: true });
    await fs.writeFile(args.output, JSON.stringify({ results, failures }, null, 2) + "\n", "utf8");

    if (!args.dryRun) {
      await applyUpdates(pool, updates);
    }

    console.log(JSON.stringify({ updated: updates.length, failures: failures.length, dry_run: args.dryRun, output: args.output }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
