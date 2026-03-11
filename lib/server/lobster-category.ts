import type { LobsterCategory } from "./types";

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function isWorkspaceLike(haystack: string, tags: string[]) {
  return (
    tags.includes("workspace") ||
    tags.includes("starter") ||
    tags.includes("template") ||
    tags.includes("config") ||
    includesAny(haystack, [
      "starter",
      "starter kit",
      "starter pack",
      "openclaw-config",
      "openclaw config",
      "openclaw workspace",
      "workspace add-on",
      "workspace addon",
      "workspace template",
      "workspace backup",
      "project template",
      "scaffolding template",
      "subagents workspace",
      "subagents workspaces",
      "private deployment",
      "self-hosted ai assistant",
      "社区版",
      "中文社区版",
      "完整中文本地化",
    ])
  );
}

export function classifyLobsterCategory(input: {
  slug: string;
  name: string;
  summary?: string | null;
  tags?: string[];
  sourceUrl?: string | null;
  sourceRepo?: string | null;
}): LobsterCategory {
  const slug = normalize(input.slug);
  const name = normalize(input.name);
  const summary = normalize(input.summary);
  const source = normalize(input.sourceRepo || input.sourceUrl);
  const tags = (input.tags ?? []).map((tag) => normalize(tag));
  const combined = [slug, name, summary, source, tags.join(" ")].filter(Boolean).join(" ");
  const workspaceLike = isWorkspaceLike(combined, tags);

  if (includesAny(combined, ["memory management", "memory-manager", "memory-management"])) {
    return "memory";
  }

  if (
    includesAny(combined, ["memory system", "memory engine", "memory architecture"]) &&
    !workspaceLike
  ) {
    return "memory";
  }

  if (
    (tags.includes("workflow") ||
      includesAny(combined, [
        "workflow",
        "orchestration",
        "research ops",
        "multi agent",
        "multi-agent",
        "approval flow",
        "dispatch architecture",
        "kanban",
      ])) &&
    !workspaceLike
  ) {
    return "workflow";
  }

  if (
    includesAny(combined, [
      "skill",
      "skills",
      "-skill",
      " skill ",
      "skills kit",
      "openclaw skill",
      "thumbnail designer",
      "youtube thumbnail",
      "photo bank",
      "logo bank",
    ]) &&
    !workspaceLike &&
    !includesAny(combined, ["studio", "console", "plugin", "plugins", "docker"])
  ) {
    return "skill";
  }

  if (
    includesAny(combined, [
      "console",
      "studio",
      "docker",
      "plugins",
      "plugin",
      "control panel",
      "deployment",
      "monitoring",
      "manager",
      "blueprint",
      "mcp upload",
      "tooling",
      "cli",
      "terminal ui",
    ]) &&
    !workspaceLike
  ) {
    return "tooling";
  }

  if (
    includesAny(combined, [
      "agent persona",
      "sub-agent",
      "subagent",
      "designer agent",
      "researcher agent",
      "reviewer agent",
      "assistant persona",
    ]) &&
    !workspaceLike
  ) {
    return "agent";
  }

  return "workspace";
}
