import { CommentItem, LobsterDetail, LobsterSummary, MeProfile, UserProfile } from "./types";

const now = new Date("2026-03-07T10:00:00.000Z").toISOString();

const seededLobsters: LobsterDetail[] = [
  {
    slug: "openclaw-starter-pack",
    name: "OpenClaw Starter Pack",
    summary: "A clean starter bundle with AGENTS.md patterns, publish flow notes, and seed content guidelines for cold-starting a hub.",
    license: "MIT",
    owner_handle: "clawhub",
    owner_display_name: "ClawHub Curated",
    tags: ["starter", "agents", "seed"],
    latest_version: "1.2.0",
    favorite_count: 18,
    share_count: 7,
    comment_count: 3,
    hot_score: 22.4,
    status: "active",
    created_at: now,
    search_document:
      "OpenClaw Starter Pack AGENTS.md cold start curated examples seed configs upload guide MCP publish flow",
    versions: [
      {
        version: "1.2.0",
        changelog: "Refined AGENTS guidance and added curated seed examples.",
        readme_text: `# OpenClaw Starter Pack

This bundle is meant for cold-starting a public hub.

## Includes

- a compact \`AGENTS.md\`
- a seed content policy
- starter upload examples
- a publishing checklist

## Why it exists

Early users need examples before they need community.`,
        manifest_url: "file:///seed/openclaw-starter-pack/manifest.json",
        readme_url: "file:///seed/openclaw-starter-pack/README.md",
        skills_bundle_url: "file:///seed/openclaw-starter-pack/skills_bundle.zip",
        created_at: now,
        source_repo: "https://github.com/example/openclaw-starter-pack",
        source_commit: "seed123",
        workspace_files: [
          {
            path: "AGENTS.md",
            size: 612,
            kind: "text",
            content_excerpt: "You are an OpenClaw publishing agent. Keep uploads tidy, searchable, and versioned.",
          },
          {
            path: "skills/starter-curator.py",
            size: 1240,
            kind: "text",
            content_excerpt: "def curate_seed_examples(items):\n    return [item for item in items if item.get('quality') == 'high']",
          },
        ],
        skills: [
          {
            skill_id: "starter-curator",
            name: "Starter Curator",
            entry: "skills/starter-curator.py",
            path: "skills/starter-curator.py",
          },
        ],
      },
    ],
  },
  {
    slug: "mcp-upload-blueprint",
    name: "MCP Upload Blueprint",
    summary: "A reference upload package for versioned README, manifest, and skill bundle release flow.",
    license: "Apache-2.0",
    owner_handle: "seed-labs",
    owner_display_name: "Seed Labs",
    tags: ["mcp", "upload", "manifest"],
    latest_version: "0.9.1",
    favorite_count: 11,
    share_count: 4,
    comment_count: 2,
    hot_score: 16.7,
    status: "active",
    created_at: now,
    search_document: "MCP Upload Blueprint versioned manifest readme PAT upload release flow",
    versions: [
      {
        version: "0.9.1",
        changelog: "Added upload cURL examples and release metadata notes.",
        readme_text: `# MCP Upload Blueprint

Use this when you want a reproducible upload contract.

## Files

- \`manifest.json\`
- \`README.md\`
- \`skills_bundle.zip\`

## Upload contract

Authenticate with a PAT and send the three files in one multipart request.`,
        manifest_url: "file:///seed/mcp-upload-blueprint/manifest.json",
        readme_url: "file:///seed/mcp-upload-blueprint/README.md",
        skills_bundle_url: "file:///seed/mcp-upload-blueprint/skills_bundle.zip",
        created_at: now,
        source_repo: "https://github.com/example/mcp-upload-blueprint",
        source_commit: "seed456",
        workspace_files: [
          {
            path: "manifest.json",
            size: 844,
            kind: "text",
            content_excerpt: "{\"schema_version\":\"1.0\",\"lobster_slug\":\"mcp-upload-blueprint\",\"version\":\"0.9.1\"}",
          },
          {
            path: "skills/manifest-builder.py",
            size: 920,
            kind: "text",
            content_excerpt: "def build_manifest(readme_path, skills):\n    return {\"readme_path\": readme_path, \"skills\": skills}",
          },
        ],
        skills: [
          {
            skill_id: "manifest-builder",
            name: "Manifest Builder",
            entry: "skills/manifest-builder.py",
            path: "skills/manifest-builder.py",
          },
        ],
      },
    ],
  },
  {
    slug: "research-ops-lobster",
    name: "Research Ops Lobster",
    summary: "A research-heavy OpenClaw setup with source-grounding, notes capture, and reusable analyst prompts.",
    license: "CC-BY-4.0",
    owner_handle: "analyst-ivy",
    owner_display_name: "Ivy Chen",
    tags: ["research", "prompts", "workflow"],
    latest_version: "2.0.0",
    favorite_count: 9,
    share_count: 2,
    comment_count: 1,
    hot_score: 13.2,
    status: "active",
    created_at: now,
    search_document: "research ops lobster analyst prompts note capture source grounding workflow",
    versions: [
      {
        version: "2.0.0",
        changelog: "Published source-grounded prompt pack and documentation refresh.",
        readme_text: `# Research Ops Lobster

This package is for source-grounded research work.

## Workflow

1. ingest source material
2. extract claims
3. annotate confidence
4. export notes and answer drafts`,
        manifest_url: "file:///seed/research-ops-lobster/manifest.json",
        readme_url: "file:///seed/research-ops-lobster/README.md",
        skills_bundle_url: "file:///seed/research-ops-lobster/skills_bundle.zip",
        created_at: now,
        source_repo: "https://github.com/example/research-ops-lobster",
        source_commit: "seed789",
        workspace_files: [
          {
            path: "notes/source-checklist.md",
            size: 402,
            kind: "text",
            content_excerpt: "- verify primary source\n- capture confidence\n- keep citations inline",
          },
        ],
        skills: [
          {
            skill_id: "source-grounder",
            name: "Source Grounder",
            entry: "skills/source-grounder.py",
            path: "skills/source-grounder.py",
          },
        ],
      },
    ],
  },
];

const seededComments: CommentItem[] = [
  {
    id: 1,
    lobster_slug: "openclaw-starter-pack",
    user_handle: "clawfan",
    user_display_name: "Claw Fan",
    content: "This is the clearest starter pack I have seen so far.",
    created_at: now,
  },
  {
    id: 2,
    lobster_slug: "openclaw-starter-pack",
    user_handle: "seed-labs",
    user_display_name: "Seed Labs",
    content: "The seed/curated split is especially useful for cold start.",
    created_at: now,
  },
  {
    id: 3,
    lobster_slug: "mcp-upload-blueprint",
    user_handle: "ivy",
    user_display_name: "Ivy",
    content: "Would like a CLI publish example next.",
    created_at: now,
  },
];

const summaries = seededLobsters.map<LobsterSummary>((item) => ({
  slug: item.slug,
  name: item.name,
  summary: item.summary,
  license: item.license,
  source_type: item.source_type,
  source_url: item.source_url,
  original_author: item.original_author,
  verified: item.verified,
  curation_note: item.curation_note,
  seeded_at: item.seeded_at,
  owner_handle: item.owner_handle,
  owner_display_name: item.owner_display_name,
  tags: item.tags,
  latest_version: item.latest_version,
  favorite_count: item.favorite_count,
  share_count: item.share_count,
  comment_count: item.comment_count,
  hot_score: item.hot_score,
  status: item.status,
  created_at: item.created_at,
}));

export function listMockLobsters(params?: { sort?: string; tag?: string; q?: string }) {
  let items = [...summaries];
  if (params?.tag?.trim()) {
    const tag = params.tag.trim().toLowerCase();
    items = items.filter((item) => item.tags.includes(tag));
  }
  if (params?.q?.trim()) {
    const q = params.q.trim().toLowerCase();
    items = items.filter((item) =>
      [item.name, item.summary, item.tags.join(" ")].join(" ").toLowerCase().includes(q),
    );
  }
  items.sort((a, b) => {
    if (params?.sort === "new") return +new Date(b.created_at) - +new Date(a.created_at);
    if (b.hot_score !== a.hot_score) return b.hot_score - a.hot_score;
    return +new Date(b.created_at) - +new Date(a.created_at);
  });
  return { items, total: items.length };
}

export function getMockLobster(slug: string) {
  return seededLobsters.find((item) => item.slug === slug) ?? null;
}

export function getMockComments(slug: string) {
  return seededComments.filter((comment) => comment.lobster_slug === slug);
}

export function getMockUserProfile(handle: string): UserProfile | null {
  const userLobsters = summaries.filter((item) => item.owner_handle === handle);
  if (handle === "clawhub") {
    return {
      user: {
        id: 1,
        handle: "clawhub",
        display_name: "ClawHub Curated",
        avatar_url: null,
        bio: "Official curated examples for OpenClaw cold start.",
      },
      hire_profile: null,
      published: userLobsters,
      favorites: summaries.slice(1),
    };
  }
  if (handle === "seed-labs") {
    return {
      user: {
        id: 2,
        handle: "seed-labs",
        display_name: "Seed Labs",
        avatar_url: null,
        bio: "Reference bundles and upload blueprints.",
      },
      hire_profile: {
        status: "open",
        contact_type: "email",
        contact_value: "seed@example.com",
        timezone: "UTC+8",
        response_sla_hours: 24,
      },
      published: userLobsters,
      favorites: [summaries[0]],
    };
  }
  if (handle === "analyst-ivy") {
    return {
      user: {
        id: 3,
        handle: "analyst-ivy",
        display_name: "Ivy Chen",
        avatar_url: null,
        bio: "Research-oriented OpenClaw operator.",
      },
      hire_profile: {
        status: "open",
        contact_type: "url",
        contact_value: "https://example.com/ivy",
        timezone: "Asia/Shanghai",
        response_sla_hours: 12,
      },
      published: userLobsters,
      favorites: [summaries[0], summaries[1]],
    };
  }
  return null;
}

export function getMockMeProfile(handle = "clawhub"): MeProfile | null {
  const profile = getMockUserProfile(handle);
  if (!profile) return null;
  return {
    user: profile.user,
    hire_profile: profile.hire_profile,
    active_token_prefix: "claw_pat_demo_1234",
    active_token_last_used_at: now,
  };
}
