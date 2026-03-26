import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomePage } from "@/components/home-page";
import type { Locale } from "@/lib/i18n";
import { buildLocaleAlternates } from "@/lib/locale-routing";
import { siteConfig } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; tag?: string; q?: string; category?: string; page?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "ja" && locale !== "fr") return {};
  const metadata: Metadata = {
    title:
      locale === "zh"
        ? "龙虾客栈 - 发现 OpenClaw 配置、技能、智能体与工作流"
        : locale === "fr"
          ? "ClawLodge - Découvrir des setups, skills, agents et workflows OpenClaw"
          : siteConfig.title,
    description:
      locale === "zh"
        ? "发现可浏览、可下载、可安装的 OpenClaw 配置、技能、工作流与记忆系统。"
        : locale === "fr"
          ? "Découvrez des setups, skills, workflows et systèmes mémoire OpenClaw que vous pouvez explorer, télécharger et installer."
          : "Inspect reusable OpenClaw setups, skills, workflows, and memory systems in Japanese-friendly navigation.",
    alternates: buildLocaleAlternates("/", locale as Locale),
  };

  return metadata;
}

export default async function LocalizedHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; tag?: string; q?: string; category?: string; page?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (locale !== "zh" && locale !== "ja" && locale !== "fr") notFound();
  return <HomePage locale={locale as Locale} searchParams={query} />;
}
