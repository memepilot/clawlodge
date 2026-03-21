import { notFound } from "next/navigation";

import { AboutPage, buildAboutMetadata } from "@/components/about-page";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "ja") return {};
  return buildAboutMetadata(locale);
}

export default async function LocalizedAboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "ja") notFound();
  return <AboutPage locale={locale} />;
}
