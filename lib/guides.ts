import type { Metadata } from "next";

import { absoluteUrl, buildSocialImages, siteConfig } from "@/lib/site";

export type GuideSlug =
  | "openclaw-memory-allocation-strategies"
  | "openclaw-config-file"
  | "openclaw-multi-agent-workflows";

export type GuideDefinition = {
  slug: GuideSlug;
  title: {
    en: string;
    zh: string;
  };
  description: {
    en: string;
    zh: string;
  };
  intro: {
    en: string;
    zh: string;
  };
  sections: Array<{
    title: {
      en: string;
      zh: string;
    };
    body: {
      en: string;
      zh: string;
    };
  }>;
  relatedCategories?: string[];
  relatedTopics?: string[];
  relatedTags?: string[];
};

export const GUIDE_DEFINITIONS: GuideDefinition[] = [
  {
    slug: "openclaw-memory-allocation-strategies",
    title: {
      en: "OpenClaw Memory Allocation Strategies",
      zh: "OpenClaw 记忆分配策略",
    },
    description: {
      en: "A practical guide to structuring OpenClaw memory across long-term memory, working memory, and project context.",
      zh: "用长期记忆、工作记忆和项目上下文来组织 OpenClaw memory 的实用指南。",
    },
    intro: {
      en: "Use this page to compare how OpenClaw setups handle memory layers, retention, and project context.",
      zh: "通过这个页面比较不同 OpenClaw 配置如何处理记忆分层、留存和项目上下文。",
    },
    sections: [
      {
        title: {
          en: "What good memory design looks like",
          zh: "好的记忆设计长什么样",
        },
        body: {
          en: "A strong OpenClaw memory system separates durable preferences, project notes, and short-lived task context. The best setups make those layers visible in files, templates, and daily workflows.",
          zh: "优秀的 OpenClaw memory 体系会把长期偏好、项目记录和临时任务上下文拆开。好的配置会把这些层次落实到文件、模板和日常工作流里。",
        },
      },
      {
        title: {
          en: "What to compare",
          zh: "应该比较什么",
        },
        body: {
          en: "Look for explicit memory folders, promotion rules, archive rules, and workflow hooks. If a setup only says “has memory” but gives no operating structure, the gain over vanilla OpenClaw is usually weak.",
          zh: "重点看是否有清晰的 memory 目录、晋升规则、归档规则和 workflow 钩子。如果只写“有记忆”但没有操作结构，通常比原版 OpenClaw 强不了多少。",
        },
      },
    ],
    relatedCategories: ["memory", "workspace"],
    relatedTopics: ["research", "productivity", "multiagent"],
    relatedTags: ["memory", "openclaw"],
  },
  {
    slug: "openclaw-config-file",
    title: {
      en: "OpenClaw Config File Guide",
      zh: "OpenClaw 配置文件指南",
    },
    description: {
      en: "Learn what an OpenClaw config file usually includes, what to compare, and which community setups are worth starting from.",
      zh: "了解 OpenClaw 配置文件通常包含什么、应该比较哪些维度，以及哪些社区配置值得直接起步。",
    },
    intro: {
      en: "This guide helps visitors understand what makes a reusable OpenClaw config worth adopting.",
      zh: "这个指南帮助访客理解什么样的 OpenClaw 配置值得直接领养和安装。",
    },
    sections: [
      {
        title: {
          en: "What a strong config includes",
          zh: "强配置应该包含什么",
        },
        body: {
          en: "The strongest OpenClaw configs usually combine prompts, role instructions, memory conventions, install notes, and a clear tool story. A config is not just a prompt dump.",
          zh: "强的 OpenClaw 配置通常会把 prompts、角色规则、memory 约定、安装说明和工具链一起组织起来。它不只是提示词堆砌。",
        },
      },
      {
        title: {
          en: "How to evaluate before you install",
          zh: "安装前如何判断",
        },
        body: {
          en: "Check the README, file depth, workflows, and whether the setup has a believable operating model. Workspaces that document what they automate and how they remember context are usually stronger than pretty starter kits.",
          zh: "优先看 README、文件深度、workflows，以及这套配置有没有可信的操作模型。能说明它自动化什么、如何记忆上下文的工作区，通常比漂亮的 starter kit 更强。",
        },
      },
    ],
    relatedCategories: ["workspace", "skill"],
    relatedTopics: ["dev", "productivity"],
    relatedTags: ["openclaw", "config"],
  },
  {
    slug: "openclaw-multi-agent-workflows",
    title: {
      en: "OpenClaw Multi-Agent Workflows",
      zh: "OpenClaw 多智能体工作流",
    },
    description: {
      en: "A guide to OpenClaw setups built around role split, orchestration, and reusable multi-agent operating patterns.",
      zh: "面向角色分工、编排和可复用多智能体操作模式的 OpenClaw 配置指南。",
    },
    intro: {
      en: "Multi-agent workspaces are where OpenClaw setups often outperform a plain baseline. This page highlights what to look for.",
      zh: "多智能体工作区往往是 OpenClaw 配置真正拉开差距的地方。这个页面说明应该重点看什么。",
    },
    sections: [
      {
        title: {
          en: "Why multi-agent setups matter",
          zh: "为什么多智能体配置重要",
        },
        body: {
          en: "A good multi-agent workspace gives each role a clear job, a handoff rule, and shared memory conventions. That usually matters more than a single prompt sounding smarter.",
          zh: "好的多智能体工作区会给每个角色清晰的职责、交接规则和共享记忆约定。这通常比单条 prompt 听起来更聪明更重要。",
        },
      },
      {
        title: {
          en: "Signals of a real workflow system",
          zh: "真实工作流系统的信号",
        },
        body: {
          en: "Look for explicit workflows, review loops, install instructions, and files that define who does what. If a setup only lists many agent names without handoff logic, it rarely performs as a real system.",
          zh: "重点看显式 workflows、review 循环、安装说明，以及定义角色分工的文件。如果只是列出很多 agent 名字却没有交接逻辑，通常称不上真正的系统。",
        },
      },
    ],
    relatedCategories: ["workflow", "workspace", "agent"],
    relatedTopics: ["multiagent", "automation", "dev"],
    relatedTags: ["multi-agent", "automation", "openclaw"],
  },
];

export function getGuide(slug: string) {
  return GUIDE_DEFINITIONS.find((guide) => guide.slug === slug);
}

export function getGuideList() {
  return GUIDE_DEFINITIONS;
}

export function buildGuideMetadata(guide: GuideDefinition, locale: "en" | "zh"): Metadata {
  return {
    title: guide.title[locale],
    description: guide.description[locale],
    alternates: {
      canonical: absoluteUrl(`/guides/${guide.slug}`),
    },
    openGraph: {
      title: `${guide.title[locale]} | ${siteConfig.name}`,
      description: guide.description[locale],
      url: absoluteUrl(`/guides/${guide.slug}`),
      type: "article",
      siteName: siteConfig.name,
      images: buildSocialImages(null, `${guide.title[locale]} guide preview`),
    },
    twitter: {
      card: "summary_large_image",
      title: `${guide.title[locale]} | ${siteConfig.name}`,
      description: guide.description[locale],
      images: buildSocialImages(null, `${guide.title[locale]} guide preview`).map((image) => image.url),
    },
  };
}

export function buildGuideJsonLd(guide: GuideDefinition, locale: "en" | "zh") {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title[locale],
    description: guide.description[locale],
    url: absoluteUrl(`/guides/${guide.slug}`),
    author: {
      "@type": "Organization",
      name: siteConfig.name,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
    },
  };
}
