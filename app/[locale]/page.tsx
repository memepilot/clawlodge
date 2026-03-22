import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomePage } from "@/components/home-page";
import type { Locale } from "@/lib/i18n";
import { buildLocaleAlternates } from "@/lib/locale-routing";
import { siteConfig } from "@/lib/site";

export const revalidate = 300;

function hasHomeQuery(params: { sort?: string; tag?: string; q?: string; category?: string; page?: string }) {
  return Boolean(params.sort || params.tag || params.q || params.category || params.page);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; tag?: string; q?: string; category?: string; page?: string }>;
}): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (locale !== "zh" && locale !== "ja") return {};
  const metadata: Metadata = {
    title: locale === "zh" ? "龙虾客栈 - 发现 OpenClaw 配置、技能、智能体与工作流" : siteConfig.title,
    description:
      locale === "zh"
        ? "发现可浏览、可下载、可安装的 OpenClaw 配置、技能、工作流与记忆系统。"
        : "Inspect reusable OpenClaw setups, skills, workflows, and memory systems in Japanese-friendly navigation.",
    alternates: buildLocaleAlternates("/", locale as Locale),
  };

  if (hasHomeQuery(query)) {
    metadata.robots = {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    };
  }

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
  if (locale !== "zh" && locale !== "ja") notFound();
  return <HomePage locale={locale as Locale} searchParams={query} />;
}
