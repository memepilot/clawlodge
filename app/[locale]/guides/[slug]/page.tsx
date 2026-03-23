import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuidePage } from "@/components/guide-page";
import { buildGuideMetadata, getGuideBySlug, getGuides } from "@/lib/guides";

export function generateStaticParams() {
  return ["zh", "ja", "fr"].flatMap((locale) => getGuides(locale as "zh" | "ja" | "fr").map((guide) => ({ locale, slug: guide.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (locale !== "zh" && locale !== "ja" && locale !== "fr") return {};
  const guide = getGuideBySlug(slug, locale);
  if (!guide) return {};
  return buildGuideMetadata(guide, locale);
}

export default async function LocalizedGuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (locale !== "zh" && locale !== "ja" && locale !== "fr") notFound();
  return <GuidePage slug={slug} locale={locale} />;
}
