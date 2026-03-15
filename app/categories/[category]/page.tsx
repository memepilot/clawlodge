import { notFound } from "next/navigation";

import { LobsterCollectionPage } from "@/components/lobster-collection-page";
import { buildCollectionMetadata, categoryIntro, categoryLabel, CATEGORY_OPTIONS } from "@/lib/lobster-taxonomy";
import { getTranslations } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server/locale";
import { listLobsters } from "@/lib/server/service";
import type { LobsterCategory } from "@/lib/types";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const locale = await getRequestLocale();
  const match = CATEGORY_OPTIONS.find((option) => option.value === category);
  if (!match) return {};
  const title = `${categoryLabel(match.value, locale)} ${locale === "zh" ? "OpenClaw 配置" : "OpenClaw Setups"}`;
  return buildCollectionMetadata({
    title,
    description: categoryIntro(match.value, locale),
    pathname: `/categories/${match.value}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const [{ category }, query] = await Promise.all([params, searchParams]);
  const locale = await getRequestLocale();
  const t = getTranslations(locale);
  const match = CATEGORY_OPTIONS.find((option) => option.value === category);
  if (!match) notFound();
  const sort = query.sort === "new" ? "new" : "hot";
  const page = Number.isFinite(Number(query.page)) ? Math.max(1, Math.floor(Number(query.page))) : 1;
  const result = await listLobsters({
    category: match.value,
    sort,
    page,
    per_page: 18,
  });
  const pathname = `/categories/${match.value}`;
  const title = `${categoryLabel(match.value, locale)} ${locale === "zh" ? "OpenClaw 配置" : "OpenClaw Setups"}`;

  return (
    <LobsterCollectionPage
      locale={locale}
      title={title}
      intro={categoryIntro(match.value, locale)}
      pathname={pathname}
      result={result}
      sort={sort}
      buildPageHref={(nextPage) => {
        const search = new URLSearchParams();
        if (sort !== "hot") search.set("sort", sort);
        if (nextPage > 1) search.set("page", String(nextPage));
        const suffix = search.toString();
        return suffix ? `${pathname}?${suffix}` : pathname;
      }}
    />
  );
}
