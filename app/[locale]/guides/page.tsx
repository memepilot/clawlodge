import { notFound } from "next/navigation";

import { GuidesIndexPage } from "@/components/guides-index-page";
import { buildLocaleAlternates } from "@/lib/locale-routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "ja" && locale !== "fr") return {};
  return {
    title: locale === "zh" ? "OpenClaw 指南" : locale === "fr" ? "Guides OpenClaw" : "OpenClawガイド",
    description:
      locale === "zh"
        ? "关于 OpenClaw 配置文件、记忆策略和多智能体工作区设计的实用指南。"
        : locale === "fr"
          ? "Guides pratiques sur les config files OpenClaw, les stratégies mémoire et la conception multi-agents."
          : "OpenClawの設定、メモリ戦略、マルチエージェント設計に関する実践ガイド。",
    alternates: buildLocaleAlternates("/guides", locale),
  };
}

export default async function LocalizedGuidesIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "ja" && locale !== "fr") notFound();
  return <GuidesIndexPage locale={locale} />;
}
