import { getMockComments, getMockLobster } from "@/lib/mock-data";

import { DbState } from "./types";

export function seededState(): DbState {
  const now = new Date("2026-03-07T10:00:00.000Z").toISOString();

  const users = [
    {
      id: 1,
      handle: "clawhub",
      displayName: "ClawHub Curated",
      avatarUrl: null,
      bio: "Official curated examples for OpenClaw cold start.",
      email: null,
      githubId: null,
      favoriteSlugs: ["mcp-upload-blueprint", "research-ops-lobster"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      handle: "seed-labs",
      displayName: "Seed Labs",
      avatarUrl: null,
      bio: "Reference bundles and upload blueprints.",
      email: "seed@example.com",
      githubId: null,
      favoriteSlugs: ["openclaw-starter-pack"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      handle: "analyst-ivy",
      displayName: "Ivy Chen",
      avatarUrl: null,
      bio: "Research-oriented OpenClaw operator.",
      email: null,
      githubId: null,
      favoriteSlugs: ["openclaw-starter-pack", "mcp-upload-blueprint"],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 4,
      handle: "clawfan",
      displayName: "Claw Fan",
      avatarUrl: null,
      bio: null,
      email: null,
      githubId: null,
      favoriteSlugs: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 5,
      handle: "ivy",
      displayName: "Ivy",
      avatarUrl: null,
      bio: null,
      email: null,
      githubId: null,
      favoriteSlugs: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const starter = getMockLobster("openclaw-starter-pack");
  const mcp = getMockLobster("mcp-upload-blueprint");
  const research = getMockLobster("research-ops-lobster");

  const all = [starter, mcp, research].filter(Boolean);

  return {
    nextIds: {
      user: 6,
      session: 1,
      apiToken: 1,
      hireProfile: 3,
      lobster: 4,
      lobsterVersion: 4,
      comment: 4,
      report: 1,
    },
    users,
    sessions: [],
    apiTokens: [],
    hireProfiles: [
      {
        id: 1,
        userId: 2,
        status: "open",
        contactType: "email",
        contactValue: "seed@example.com",
        timezone: "UTC+8",
        responseSlaHours: 24,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        userId: 3,
        status: "open",
        contactType: "url",
        contactValue: "https://example.com/ivy",
        timezone: "Asia/Shanghai",
        responseSlaHours: 12,
        createdAt: now,
        updatedAt: now,
      },
    ],
    lobsters: all.map((item, index) => ({
      id: index + 1,
      slug: item!.slug,
      ownerId:
        item!.owner_handle === "clawhub" ? 1 : item!.owner_handle === "seed-labs" ? 2 : 3,
      name: item!.name,
      summary: item!.summary,
      license: item!.license,
      sourceType:
        item!.slug === "openclaw-starter-pack"
          ? "official"
          : item!.slug === "mcp-upload-blueprint"
            ? "curated"
            : "demo",
      sourceUrl: item!.versions[0]?.source_repo ?? null,
      originalAuthor: item!.owner_display_name ?? item!.owner_handle,
      verified: item!.slug !== "research-ops-lobster",
      curationNote:
        item!.slug === "openclaw-starter-pack"
          ? "Platform-maintained starter bundle for cold start."
          : item!.slug === "mcp-upload-blueprint"
            ? "Curated import adapted into hub-ready upload contract."
            : "Demo workspace showing a research-oriented OpenClaw package.",
      seededAt: now,
      isHireable: item!.is_hireable,
      status: "active",
      reportPenalty: 0,
      searchDocument: item!.search_document,
      tags: item!.tags,
      favoriteCount: item!.favorite_count,
      commentCount: item!.comment_count,
      createdAt: item!.created_at,
      updatedAt: item!.created_at,
    })),
    lobsterVersions: all.flatMap((item, index) =>
      item!.versions.map((version) => ({
        id: index + 1,
        lobsterId: index + 1,
        createdBy:
          item!.owner_handle === "clawhub" ? 1 : item!.owner_handle === "seed-labs" ? 2 : 3,
        version: version.version,
        changelog: version.changelog,
        readmeText: version.readme_text,
        manifestUrl: version.manifest_url,
        readmeUrl: version.readme_url,
        skillsBundleUrl: version.skills_bundle_url ?? null,
        sourceRepo: version.source_repo ?? null,
        sourceCommit: version.source_commit ?? null,
        workspaceFiles: (version.workspace_files ?? []).map((file) => ({
          path: file.path,
          size: file.size,
          kind: file.kind,
          contentExcerpt: file.content_excerpt ?? null,
          contentText: file.content_text ?? file.content_excerpt ?? null,
          maskedCount: file.masked_count ?? 0,
        })),
        publishClient: version.publish_client ?? null,
        maskedSecretsCount: version.masked_secrets_count ?? 0,
        blockedFilesCount: version.blocked_files_count ?? 0,
        skills: version.skills.map((skill) => ({
          skillId: skill.skill_id,
          name: skill.name,
          entry: skill.entry,
          path: skill.path,
          digest: skill.digest ?? null,
          size: skill.size ?? null,
        })),
        createdAt: version.created_at,
      })),
    ),
    comments: [
      ...getMockComments("openclaw-starter-pack"),
      ...getMockComments("mcp-upload-blueprint"),
    ].map((comment) => ({
      id: comment.id,
      userId: comment.user_handle === "clawfan" ? 4 : comment.user_handle === "seed-labs" ? 2 : 5,
      lobsterId: comment.lobster_slug === "openclaw-starter-pack" ? 1 : 2,
      content: comment.content,
      createdAt: comment.created_at,
    })),
    reports: [],
  };
}
