import type { Metadata } from "next";

import { LobsterCategory, LobsterTopic } from "@/lib/types";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const CATEGORY_OPTIONS: Array<{ value: LobsterCategory; icon: string }> = [
  { value: "workspace", icon: "▣" },
  { value: "skill", icon: "✦" },
  { value: "agent", icon: "◉" },
  { value: "tooling", icon: "⌘" },
  { value: "workflow", icon: "⇄" },
  { value: "memory", icon: "◌" },
];

export function categoryLabel(category: LobsterCategory, locale: "en" | "zh") {
  if (locale === "zh") {
    switch (category) {
      case "workspace":
        return "工作区";
      case "skill":
        return "技能";
      case "agent":
        return "智能体";
      case "tooling":
        return "工具";
      case "workflow":
        return "工作流";
      case "memory":
        return "记忆";
    }
  }
  switch (category) {
    case "workspace":
      return "Workspace";
    case "skill":
      return "Skill";
    case "agent":
      return "Agent";
    case "tooling":
      return "Tooling";
    case "workflow":
      return "Workflow";
    case "memory":
      return "Memory";
  }
}

export function topicLabel(topic: LobsterTopic, locale: "en" | "zh") {
  if (locale === "zh") {
    switch (topic) {
      case "dev":
        return "开发";
      case "design":
        return "设计";
      case "research":
        return "研究";
      case "writing":
        return "写作";
      case "productivity":
        return "生产力";
      case "multiagent":
        return "多智能体";
      case "automation":
        return "自动化";
    }
  }
  switch (topic) {
    case "dev":
      return "Dev";
    case "design":
      return "Design";
    case "research":
      return "Research";
    case "writing":
      return "Writing";
    case "productivity":
      return "Productivity";
    case "multiagent":
      return "Multi-Agent";
    case "automation":
      return "Automation";
  }
}

export function categoryIntro(category: LobsterCategory, locale: "en" | "zh") {
  const en: Record<LobsterCategory, string> = {
    workspace: "Complete OpenClaw workspaces with prompts, skills, workflows, docs, and installable structure.",
    skill: "Focused OpenClaw skills and skill bundles that add a specific capability to an existing setup.",
    agent: "Role-driven agents and personas you can adopt as a standalone operator inside OpenClaw.",
    tooling: "Developer tools, consoles, studios, and utilities that support OpenClaw workflows.",
    workflow: "Repeatable multi-step OpenClaw workflows for research, automation, and team operations.",
    memory: "Memory systems, memory ops, and reusable memory architecture patterns for OpenClaw.",
  };
  const zh: Record<LobsterCategory, string> = {
    workspace: "完整的 OpenClaw 工作区，包含 prompts、skills、workflows、文档和可安装结构。",
    skill: "聚焦单一能力的 OpenClaw 技能或技能包，适合增量装到现有配置里。",
    agent: "角色驱动的智能体与人格包，可作为 OpenClaw 中的独立操作员使用。",
    tooling: "服务于 OpenClaw 工作流的开发工具、控制台、工作台和辅助工具。",
    workflow: "面向研究、自动化和团队协作的可复用 OpenClaw 工作流。",
    memory: "适用于 OpenClaw 的记忆系统、记忆运维和记忆架构模式。",
  };
  return locale === "zh" ? zh[category] : en[category];
}

export function topicIntro(topic: LobsterTopic, locale: "en" | "zh") {
  const en: Record<LobsterTopic, string> = {
    dev: "OpenClaw setups for coding, development workflows, code review, and engineering automation.",
    design: "OpenClaw setups for design work, visual systems, thumbnails, branding, and creative production.",
    research: "OpenClaw setups for research synthesis, analysis, competitive scans, and knowledge work.",
    writing: "OpenClaw setups for drafting, editing, content workflows, and publishing operations.",
    productivity: "OpenClaw setups that improve daily execution, planning, and cross-tool personal workflows.",
    multiagent: "OpenClaw setups built around multi-agent coordination, orchestration, and role specialization.",
    automation: "OpenClaw setups focused on repeatable automation, pipelines, and operator workflows.",
  };
  const zh: Record<LobsterTopic, string> = {
    dev: "面向编码、开发工作流、代码审查和工程自动化的 OpenClaw 配置。",
    design: "面向设计、视觉系统、缩略图、品牌和创意生产的 OpenClaw 配置。",
    research: "面向研究、分析、竞品扫描和知识工作的 OpenClaw 配置。",
    writing: "面向写作、编辑、内容流程和发布协作的 OpenClaw 配置。",
    productivity: "提升日常执行、规划和跨工具协作效率的 OpenClaw 配置。",
    multiagent: "围绕多智能体协作、编排和角色分工构建的 OpenClaw 配置。",
    automation: "聚焦自动化、流水线和运营流程的 OpenClaw 配置。",
  };
  return locale === "zh" ? zh[topic] : en[topic];
}

export function buildCollectionMetadata(params: {
  title: string;
  description: string;
  pathname: string;
}): Metadata {
  return {
    title: `${params.title} | ${siteConfig.name}`,
    description: params.description,
    alternates: {
      canonical: absoluteUrl(params.pathname),
    },
    openGraph: {
      title: `${params.title} | ${siteConfig.name}`,
      description: params.description,
      url: absoluteUrl(params.pathname),
      siteName: siteConfig.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${params.title} | ${siteConfig.name}`,
      description: params.description,
    },
  };
}

export function categorySeoTitle(category: LobsterCategory, locale: "en" | "zh") {
  if (locale === "zh") {
    switch (category) {
      case "workspace":
        return "OpenClaw 工作区";
      case "skill":
        return "OpenClaw 技能";
      case "agent":
        return "OpenClaw 智能体";
      case "tooling":
        return "OpenClaw 工具";
      case "workflow":
        return "OpenClaw 工作流";
      case "memory":
        return "OpenClaw 记忆配置";
    }
  }

  switch (category) {
    case "workspace":
      return "OpenClaw Workspaces - Full Agent Systems and Setups";
    case "skill":
      return "OpenClaw Skills - Reusable Skills and Examples";
    case "agent":
      return "OpenClaw Agents - Agent Setups and Examples";
    case "tooling":
      return "OpenClaw Tooling - Consoles, Studios and Utilities";
    case "workflow":
      return "OpenClaw Workflows - Real Automation Setups";
    case "memory":
      return "OpenClaw Memory Setups - Long-Term Memory and Context Workflows";
  }
}

export function topicSeoTitle(topic: LobsterTopic, locale: "en" | "zh") {
  if (locale === "zh") {
    return `${topicLabel(topic, locale)} OpenClaw 配置`;
  }

  switch (topic) {
    case "multiagent":
      return "OpenClaw Multi-Agent Setups - Community Examples";
    case "automation":
      return "OpenClaw Automation Workflows - Practical Community Examples";
    case "design":
      return "OpenClaw for Design Work - Skills and Workflow Setups";
    case "dev":
      return "OpenClaw for Development - Skills, Agents and Setups";
    case "research":
      return "OpenClaw Research Workflows - Community Setups";
    case "writing":
      return "OpenClaw Writing Workflows - Skills and Community Setups";
    case "productivity":
      return "OpenClaw Productivity Setups - Skills and Workflow Examples";
  }
}

export function tagSeoTitle(tag: string, locale: "en" | "zh") {
  const normalized = tag.trim().toLowerCase();
  if (locale === "zh") {
    return `#${tag} OpenClaw 配置`;
  }

  switch (normalized) {
    case "openclaw":
      return "OpenClaw Setups - Community Skills, Agents and Workflows";
    case "claude-code":
      return "Claude Code with OpenClaw - Skills and Workflow Setups";
    case "multi-agent":
    case "multiagent":
      return "OpenClaw Multi-Agent Examples - Community Setups";
    case "automation":
      return "OpenClaw Automation Workflows - Practical Community Examples";
    case "creators":
    case "creator":
      return "OpenClaw for Creators - YouTube, TikTok and Content Workflows";
    case "productivity":
      return "OpenClaw Productivity Setups - Skills and Workflow Examples";
    default:
      return `OpenClaw ${tag} Setups - Community Skills and Workflows`;
  }
}

export function buildCollectionJsonLd(params: {
  title: string;
  description: string;
  pathname: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: params.title,
    description: params.description,
    url: absoluteUrl(params.pathname),
  };
}
