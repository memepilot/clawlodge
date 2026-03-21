import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";

import type { Locale } from "@/lib/i18n";
import { buildLocaleAlternates, localizePath } from "@/lib/locale-routing";
import { absoluteUrl, buildSocialImages, siteConfig } from "@/lib/site";

export type Guide = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  markdown: string;
  relatedCategorySlugs?: string[];
  relatedTopicSlugs?: string[];
  relatedLobsterSlugs?: string[];
};

type LocalizedGuideCopy = Partial<Record<Locale, Pick<Guide, "title" | "description" | "intro">>>;

const guideContentDir = path.join(process.cwd(), "content", "guides");

function readLocalizedGuideMarkdown(slug: string, locale: Locale) {
  if (locale === "en") return null;

  const filename =
    slug === "openclaw-multi-agent-config"
      ? locale === "zh"
        ? "multi-agent-config-zh.md"
        : locale === "ja"
          ? "multi-agent-config-ja.md"
          : null
      : null;

  if (!filename) return null;

  const fullPath = path.join(guideContentDir, filename);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf8");
}

const guides: Guide[] = [
  {
    slug: "openclaw-multi-agent-config",
    title: "OpenClaw Multi-Agent Config Guide",
    description:
      "Learn how to structure an OpenClaw multi-agent workspace with roles, memory, review loops, and coordination rules that actually help real work get done.",
    intro:
      "A practical guide to turning OpenClaw from one assistant into a coordinated system with roles, workflows, memory, and verification.",
    relatedCategorySlugs: ["workflow", "workspace", "memory"],
    relatedTopicSlugs: ["multiagent", "automation", "productivity"],
    relatedLobsterSlugs: ["cft0808-edict", "openclaw-config", "openclaw-memory-management"],
    markdown: `
OpenClaw can run as more than a single assistant. With the right workspace structure, it becomes a small agent team: one agent plans, one writes code, one reviews, one verifies in the browser, and one keeps long-term memory organized.

If you want examples before reading further, start with these pages:

- [OpenClaw workflow examples](/categories/workflow)
- [OpenClaw workspace examples](/categories/workspace)
- [Multi-agent OpenClaw setups](/topics/multiagent)
- [Automation-oriented setups](/topics/automation)

## What an OpenClaw multi-agent config actually is

A strong multi-agent config is not just “more prompts”. It defines:

- which agents exist
- which jobs belong to each role
- when work should be handed off
- what must be remembered
- how review and verification happen

In practice, strong examples on ClawLodge usually combine:

- a role definition layer
- explicit workflow rules
- a memory structure
- tool boundaries
- review or QA gates

Related examples:

- [cft0808-edict](/lobsters/cft0808-edict)
- [openclaw-config](/lobsters/openclaw-config)
- [openclaw-memory-management](/lobsters/openclaw-memory-management)

## The files that matter most

### \`AGENTS.md\`

This is often the coordination center. It tells OpenClaw:

- who plans
- who executes
- who reviews
- when to stop and report
- how to avoid stepping on each other

### \`SOUL.md\`

This is the behavior layer. It influences priorities, tone, and working style. A good \`SOUL.md\` changes decisions, not just voice.

### \`memory/\` or \`MEMORY.md\`

This is what makes a workspace feel trainable instead of stateless. Good memory usually stores:

- decisions already made
- user preferences
- project constraints
- recurring workflows

If memory is what you care about most, browse:

- [Memory setups](/categories/memory)
- [Research setups](/topics/research)
- [Productivity setups](/topics/productivity)

### \`skills/\`

Skills are where repeatable capabilities live:

- browser QA
- code review
- release rules
- design assistance
- publishing flows

For smaller, focused building blocks, browse:

- [OpenClaw skills](/categories/skill)
- [Design setups](/topics/design)
- [Writing setups](/topics/writing)

## How to evaluate a multi-agent workspace

When comparing workspaces, do not stop at the README. Ask:

1. Does it define real roles?
2. Does it define handoff rules?
3. Does it have memory structure?
4. Does it include verification?

The strongest workspaces on ClawLodge usually look more like operating systems than single prompts.

## Best use cases

Multi-agent OpenClaw setups are especially useful for:

- software delivery
- review-heavy engineering work
- long-running research
- publishing workflows
- personal operating systems with memory

You can browse adjacent collections here:

- [Developer setups](/topics/dev)
- [Automation workflows](/topics/automation)
- [OpenClaw workflows](/categories/workflow)
- [OpenClaw workspaces](/categories/workspace)

## Common mistakes

- treating “more agents” as automatically better
- giving every agent the same job
- skipping memory
- skipping review or browser verification

## Final thought

A good OpenClaw multi-agent config does not just add personas. It creates structure for collaboration, memory, review, and execution.

If you want real examples, start with [workflow pages](/categories/workflow), [multi-agent topic pages](/topics/multiagent), and representative setups like [Edict](/lobsters/cft0808-edict).
`,
  },
  {
    slug: "openclaw-memory-allocation-strategies",
    title: "OpenClaw Memory Allocation Strategies",
    description:
      "Understand how to structure memory in OpenClaw workspaces, from decision logs to long-term context, and explore memory-oriented examples on ClawLodge.",
    intro:
      "A guide to memory structure in OpenClaw: what to remember, where to store it, and how memory changes workspace quality over time.",
    relatedCategorySlugs: ["memory", "workspace"],
    relatedTopicSlugs: ["research", "productivity", "multiagent"],
    relatedLobsterSlugs: ["openclaw-memory-management", "openclaw-config"],
    markdown: `
Memory is one of the biggest differences between a disposable assistant and a workspace that feels trained over time.

Useful places to explore first:

- [Memory setups](/categories/memory)
- [Workspace examples](/categories/workspace)
- [Research topic](/topics/research)
- [Productivity topic](/topics/productivity)

## What memory should hold

Good OpenClaw memory usually stores:

- user preferences
- project constraints
- architectural decisions
- recurring operating rules
- unresolved questions

## What memory should not hold

Avoid storing:

- transient tool noise
- huge duplicate notes
- stale snapshots that no one updates

## Practical structures

Common patterns include:

- a decision log
- a project ledger
- role-specific notes
- a small set of stable operating principles

Study these examples:

- [openclaw-memory-management](/lobsters/openclaw-memory-management)
- [openclaw-config](/lobsters/openclaw-config)
- [Multi-agent setups](/topics/multiagent)

## Why memory matters

Without memory, workspaces tend to rediscover the same context over and over. With memory, they become easier to guide and easier to trust.
`,
  },
  {
    slug: "openclaw-config-file",
    title: "OpenClaw Config File Guide",
    description:
      "A practical guide to OpenClaw config files, workspace structure, installation paths, and how to inspect reusable community setups on ClawLodge.",
    intro:
      "Learn what an OpenClaw config file usually includes, how it fits into a workspace, and where to find strong reusable examples.",
    relatedCategorySlugs: ["workspace", "skill", "tooling"],
    relatedTopicSlugs: ["dev", "automation"],
    relatedLobsterSlugs: ["openclaw-config", "yureikara-claw-config", "shouzehao-jpg-openclaw-config"],
    markdown: `
If you are evaluating OpenClaw setups, the config file is only one layer of the story. The best workspaces combine config, skills, docs, memory, and workflows.

Good places to browse:

- [OpenClaw workspaces](/categories/workspace)
- [OpenClaw skills](/categories/skill)
- [OpenClaw tooling](/categories/tooling)
- [Developer setups](/topics/dev)

## What a config file usually controls

An OpenClaw config normally defines:

- agent defaults
- model and tool preferences
- workspace wiring
- behavioral defaults

## What it does not replace

A config file is not the whole workspace. Strong setups usually add:

- \`AGENTS.md\`
- \`SOUL.md\`
- memory structure
- specialized skills
- README guidance

## How to inspect a real setup

On ClawLodge, inspect:

- the README
- the workspace tree
- the source repository
- the related category/topic pages

Example pages:

- [openclaw-config](/lobsters/openclaw-config)
- [yureikara-claw-config](/lobsters/yureikara-claw-config)
- [shouzehao-jpg-openclaw-config](/lobsters/shouzehao-jpg-openclaw-config)

## Final thought

The best OpenClaw config file is not a single magic file. It is a clean entry point into a structured workspace that can actually be installed, understood, and reused.
`,
  },
];

const localizedGuideCopy: Record<string, LocalizedGuideCopy> = {
  "openclaw-multi-agent-config": {
    zh: {
      title: "OpenClaw 多智能体配置指南",
      description: "学习如何为 OpenClaw 设计多智能体工作区，包括角色分工、记忆结构、评审流程和协作规则。",
      intro: "把 OpenClaw 从单个助手升级为有角色、有工作流、有记忆和验证环节的协作系统。",
    },
    ja: {
      title: "OpenClawマルチエージェント設定ガイド",
      description: "OpenClawで役割分担、メモリ、レビュー、連携ルールを備えたマルチエージェント構成を作るための実践ガイド。",
      intro: "OpenClawを単体アシスタントから、役割・ワークフロー・メモリ・検証を備えた協調システムへ変えるためのガイド。",
    },
  },
  "openclaw-memory-allocation-strategies": {
    zh: {
      title: "OpenClaw 记忆分配策略",
      description: "理解 OpenClaw 工作区中的记忆结构，从决策记录到长期上下文，并查看龙虾客栈里的记忆型示例。",
      intro: "一份关于 OpenClaw 记忆结构的实用指南：该记什么、存在哪里，以及记忆如何改变工作区质量。",
    },
    ja: {
      title: "OpenClawメモリ戦略ガイド",
      description: "意思決定ログから長期コンテキストまで、OpenClawワークスペースのメモリ設計を理解するための実践ガイド。",
      intro: "OpenClawのメモリ構造で何を記録し、どこに保存し、どう品質向上につなげるかを整理したガイド。",
    },
  },
  "openclaw-config-file": {
    zh: {
      title: "OpenClaw 配置文件指南",
      description: "理解 OpenClaw config file 的作用、工作区结构，以及如何在龙虾客栈中挑选可复用配置。",
      intro: "了解 OpenClaw 配置文件通常包含什么，它在工作区中承担什么角色，以及去哪里找高质量示例。",
    },
    ja: {
      title: "OpenClaw設定ファイルガイド",
      description: "OpenClawのconfig fileが何を担うのか、ワークスペース構造の中でどう機能するのかを整理したガイド。",
      intro: "OpenClawの設定ファイルに含まれる内容と、再利用可能な構成例を見分けるポイントをまとめました。",
    },
  },
};

export function getGuides(locale: Locale = "en") {
  return guides.map((guide) => getGuideBySlug(guide.slug, locale)!);
}

export function getGuideBySlug(slug: string, locale: Locale = "en") {
  const guide = guides.find((entry) => entry.slug === slug) ?? null;
  if (!guide) return null;
  const overrides = localizedGuideCopy[slug]?.[locale];
  const merged = overrides
    ? {
        ...guide,
        ...overrides,
      }
    : guide;
  if (locale === "en") return merged;
  const localizedMarkdown = readLocalizedGuideMarkdown(slug, locale) ?? merged.markdown;
  return {
    ...merged,
    markdown: localizedMarkdown.replace(/\]\((\/(?:categories|topics|tags|guides|lobsters)\/[^)]+)\)/g, (_match, path) => {
      return `](${localizePath(path, locale)})`;
    }),
  };
}

export function buildGuideMetadata(guide: Guide, locale: Locale = "en"): Metadata {
  const pathname = localizePath(`/guides/${guide.slug}`, locale);
  return {
    title: guide.title,
    description: guide.description,
    alternates: {
      ...buildLocaleAlternates(`/guides/${guide.slug}`, locale),
    },
    openGraph: {
      title: `${guide.title} | ${siteConfig.name}`,
      description: guide.description,
      url: absoluteUrl(pathname),
      type: "article",
      siteName: siteConfig.name,
      images: buildSocialImages(null, `${guide.title} guide preview`),
    },
    twitter: {
      card: "summary_large_image",
      title: `${guide.title} | ${siteConfig.name}`,
      description: guide.description,
      site: siteConfig.xHandle,
      images: buildSocialImages(null, `${guide.title} guide preview`).map((image) => image.url),
    },
  };
}
