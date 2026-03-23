import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";

import type { Locale } from "@/lib/i18n";
import { buildLocaleAlternates, localizePath } from "@/lib/locale-routing";
import { absoluteUrl, buildSocialImages, siteConfig } from "@/lib/site";

type AboutPageContent = {
  label: string;
  title: string;
  description: string;
  intro: string;
  markdown: string;
};

const aboutContentDir = path.join(process.cwd(), "content", "pages");

const aboutBase: Record<Locale, Omit<AboutPageContent, "markdown">> = {
  en: {
    label: "About",
    title: "About ClawLodge",
    description: "Learn what ClawLodge is, how it organizes OpenClaw workspaces, skills, agents, workflows, and memory setups, and why the site exists.",
    intro: "ClawLodge is an OpenClaw publishing, discovery, and installation directory built around reusable workspaces, skills, workflows, and memory systems.",
  },
  zh: {
    label: "关于",
    title: "关于龙虾客栈",
    description: "了解龙虾客栈是什么，它如何组织 OpenClaw 工作区、技能、智能体、工作流与记忆配置，以及这个站点存在的原因。",
    intro: "龙虾客栈是一个围绕 OpenClaw 工作区、技能、工作流与记忆系统构建的发布、发现与安装目录。",
  },
  ja: {
    label: "概要",
    title: "ClawLodgeについて",
    description: "ClawLodge が何を目指すサイトなのか、OpenClaw のワークスペース、スキル、エージェント、ワークフロー、メモリ構成をどう整理しているのかを説明します。",
    intro: "ClawLodge は、OpenClaw のワークスペース、スキル、ワークフロー、メモリ構成を発見・理解・導入しやすくするためのディレクトリです。",
  },
  fr: {
    label: "À propos",
    title: "À propos de ClawLodge",
    description: "Découvrez ce qu'est ClawLodge, comment le site organise les workspaces, skills, agents, workflows et systèmes de mémoire OpenClaw, et pourquoi il existe.",
    intro: "ClawLodge est un annuaire de publication, de découverte et d'installation centré sur les workspaces, skills, workflows et systèmes de mémoire OpenClaw.",
  },
};

function readAboutMarkdown(locale: Locale) {
  if (locale === "zh") {
    return fs.readFileSync(path.join(aboutContentDir, "about-zh.md"), "utf8");
  }
  if (locale === "ja") {
    return fs.readFileSync(path.join(aboutContentDir, "about-ja.md"), "utf8");
  }
  if (locale === "fr") {
    return fs.readFileSync(path.join(aboutContentDir, "about-fr.md"), "utf8");
  }
  return `ClawLodge is a publishing, discovery, and installation directory for the OpenClaw ecosystem. It is designed to make reusable OpenClaw workspaces easier to browse, understand, and adopt.

On ClawLodge you can explore:

- [Workspaces](/categories/workspace)
- [Skills](/categories/skill)
- [Workflows](/categories/workflow)
- [Memory setups](/categories/memory)
- [Multi-agent topics](/topics/multiagent)
- [Developer setups](/topics/dev)

## Why ClawLodge exists

OpenClaw repositories are increasingly shared across GitHub, personal blogs, demo repos, starter kits, and local workspace exports. That makes experimentation possible, but it also makes discovery messy.

Common problems include:

- not knowing where to start
- not knowing which repository fits a specific task
- seeing only a README instead of the real workspace structure
- downloading a repo without knowing whether it is installable or reusable

ClawLodge exists to make those OpenClaw assets easier to inspect and reuse.

## What you can do here

### Discover usable OpenClaw setups

You can browse by asset type and by task intent:

- [Workspace pages](/categories/workspace)
- [Skill pages](/categories/skill)
- [Workflow pages](/categories/workflow)
- [Multi-agent topic pages](/topics/multiagent)
- [Automation topic pages](/topics/automation)
- [Design topic pages](/topics/design)

### Inspect real workspace structure

Many lobster pages include:

- README rendering
- workspace file trees
- versions
- zip downloads
- source repository links
- related pages

That makes ClawLodge more useful than a plain README index.

### Download and install

With \`clawlodge-cli\`, users can:

- search setups
- inspect details
- download workspace zips
- install a lobster into a new OpenClaw agent

This is one of the main differences between ClawLodge and a simple resource directory.

## What kinds of content matter most

### Full workspaces

These are closer to installable OpenClaw systems, often including:

- AGENTS.md
- SOUL.md
- skills
- memory
- workflows
- README

### Focused skills

These are smaller additions you can layer onto an existing workspace:

- browser QA
- code review
- design assistance
- writing and publishing flows

### Multi-agent and workflow systems

These setups show the real value of OpenClaw workspaces: not that a model becomes magically smarter, but that work becomes more structured and more stable.

Useful starting points:

- [Multi-agent topic](/topics/multiagent)
- [Workflow category](/categories/workflow)
- [OpenClaw Multi-Agent Config Guide](/guides/openclaw-multi-agent-config)

### Memory systems

Some workspaces are most valuable because of how they structure memory rather than how many skills they ship.

Useful pages:

- [Memory category](/categories/memory)
- [OpenClaw Memory Allocation Strategies](/guides/openclaw-memory-allocation-strategies)

## Representative pages

If you are new to ClawLodge, these are good places to start:

- [openclaw-config](/lobsters/openclaw-config)
- [openclaw-memory-management](/lobsters/openclaw-memory-management)
- [cft0808-edict](/lobsters/cft0808-edict)
- [OpenClaw config file guide](/guides/openclaw-config-file)

## Final thought

ClawLodge is not trying to be another list of prompts or a generic AI resource page. It is trying to become a practical directory layer for reusable OpenClaw systems.

- Site: [https://clawlodge.com](https://clawlodge.com)
- Source: [GitHub](${siteConfig.githubUrl})
`;
}

export function getAboutPage(locale: Locale): AboutPageContent {
  return {
    ...aboutBase[locale],
    markdown: readAboutMarkdown(locale).replace(/\]\((\/(?:categories|topics|tags|guides|lobsters|about)\/[^)]+)\)/g, (_match, p) => {
      return `](${localizePath(p, locale)})`;
    }),
  };
}

export function buildAboutMetadata(locale: Locale): Metadata {
  const page = getAboutPage(locale);
  const pathname = localizePath("/about", locale);
  return {
    title: page.title,
    description: page.description,
    alternates: {
      ...buildLocaleAlternates("/about", locale),
    },
    openGraph: {
      title: `${page.title} | ${siteConfig.name}`,
      description: page.description,
      url: absoluteUrl(pathname),
      siteName: siteConfig.name,
      type: "article",
      images: buildSocialImages(null, `${page.title} preview`),
    },
    twitter: {
      card: "summary_large_image",
      title: `${page.title} | ${siteConfig.name}`,
      description: page.description,
      site: siteConfig.xHandle,
      images: buildSocialImages(null, `${page.title} preview`).map((image) => image.url),
    },
  };
}
