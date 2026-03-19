import type { Metadata } from "next";

import { MarkdownContent } from "@/components/markdown-content";
import { getTranslations } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server/locale";
import { absoluteUrl, buildSocialImages, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn what ClawLodge is and how it helps people share, discover, and reuse powerful OpenClaw setups.",
  alternates: {
    canonical: absoluteUrl("/about"),
  },
  openGraph: {
    title: "About | ClawLodge",
    description: "Learn what ClawLodge is and how it helps people share, discover, and reuse powerful OpenClaw setups.",
    url: absoluteUrl("/about"),
    siteName: siteConfig.name,
    type: "article",
    images: buildSocialImages(null, "About ClawLodge preview"),
  },
  twitter: {
    card: "summary_large_image",
    title: "About | ClawLodge",
    description: "Learn what ClawLodge is and how it helps people share, discover, and reuse powerful OpenClaw setups.",
    images: buildSocialImages(null, "About ClawLodge preview").map((image) => image.url),
  },
};

export default async function AboutPage() {
  const locale = await getRequestLocale();
  const t = getTranslations(locale);
  const body =
    locale === "zh"
      ? `
# ${t.about.title}

${t.about.p1}

${t.about.p2}

${t.about.p3Prefix} [${siteConfig.origin}](${siteConfig.origin})，${t.about.p3Middle} [GitHub](${siteConfig.githubUrl})。

## 你可以在这里做什么

- 浏览真实的 OpenClaw 配置、技能、智能体和工作流
- 打开 README、查看 workspace 树，先理解内部结构，再决定是否下载
- 通过网页或 CLI 发布自己的 OpenClaw workspace

## 一个公开页面通常包含什么

- 可读的 README 和使用背景
- 可浏览的 workspace 文件树与预览内容
- 版本、下载入口、源码链接和社区互动信息

## 适合谁

- 想直接复用成熟 OpenClaw 配置的开发者和团队
- 在做研究、写作、设计、自动化或多智能体编排的人
- 希望把自己的方法论打包成可分享资源的创作者

## 发布流程

1. 整理好 README、关键 skills、prompts、配置和必要的 workspace 文件
2. 通过网页发布，或者用 CLI 从本地 workspace 直接推送
3. 让其他人先看结构、再下载快照、再决定是否复用

[发布你的配置](${absoluteUrl("/publish")}) · [安装 CLI](${siteConfig.npmCliUrl}) · [GitHub](${siteConfig.githubUrl})

## 原则

- 强调可复用性，而不是只展示概念
- 优先 inspect-first，而不是盲下压缩包
- 重视真实工作流、可迁移技能和明确来源
`
      : `
# ${t.about.title}

${t.about.p1}

${t.about.p2}

${t.about.p3Prefix} [${siteConfig.origin}](${siteConfig.origin}) ${t.about.p3Middle} [GitHub](${siteConfig.githubUrl}).

## What You Can Do Here

- Browse real OpenClaw setups, skills, agents, and workflows published by the community
- Inspect the README and workspace tree before you decide what to reuse or download
- Publish your own OpenClaw workspace from the browser or the CLI

## What A Public Page Includes

- A readable README with context and usage notes
- A browsable workspace tree so people can inspect the real structure
- Versions, download links, source references, and community actions

## Who It Is For

- Builders who want to reuse solid OpenClaw setups instead of starting from zero
- Teams working on research, writing, design, automation, or multi-agent workflows
- Creators who want a cleaner way to package and share practical agent systems

## Publishing Flow

1. Prepare the README, key skills, prompts, config, and the workspace files that make the setup useful
2. Publish from the browser or send it straight from your local workspace with the CLI
3. Let other people inspect the structure first, then download the published snapshot

[Publish your setup](${absoluteUrl("/publish")}) · [Install CLI](${siteConfig.npmCliUrl}) · [GitHub](${siteConfig.githubUrl})

## Principles

- Reuse over vague inspiration
- Inspect-first instead of download-blind
- Real workflows, transferable skills, and clear source context
`;

  return (
    <div className="page-shell">
      <section className="shell page-panel p-6 md:p-8">
        <MarkdownContent value={body} />
      </section>
    </div>
  );
}
