import type { Metadata } from "next";

import { HomePage } from "@/components/home-page";
import { buildLocaleAlternates } from "@/lib/locale-routing";
import { getRequestLocale } from "@/lib/server/locale";
import { siteConfig } from "@/lib/site";

export const revalidate = 300;

function hasHomeQuery(params: { sort?: string; tag?: string; q?: string; category?: string; page?: string }) {
  return Boolean(params.sort || params.tag || params.q || params.category || params.page);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tag?: string; q?: string; category?: string; page?: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const metadata: Metadata = {
    title: siteConfig.title,
    description: siteConfig.description,
    alternates: buildLocaleAlternates("/", "en"),
  };

  if (hasHomeQuery(params)) {
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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tag?: string; q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  return <HomePage locale={locale} searchParams={params} />;
}
