import { notFound } from "next/navigation";

import { LobsterCollectionPage } from "@/components/lobster-collection-page";
import { buildCollectionMetadata, categoryGuideSlugs, categoryIntro, categorySeoTitle, CATEGORY_OPTIONS } from "@/lib/lobster-taxonomy";
import { localizePath } from "@/lib/locale-routing";
import { listLobsters } from "@/lib/server/service";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; category: string }> }) {
  const { locale, category } = await params;
  if (locale !== "zh" && locale !== "ja" && locale !== "fr") return {};
  const match = CATEGORY_OPTIONS.find((option) => option.value === category);
  if (!match) return {};
  const title = categorySeoTitle(match.value, locale);
  return buildCollectionMetadata({
    title,
    description: categoryIntro(match.value, locale),
    pathname: `/categories/${match.value}`,
    locale,
  });
}

export default async function LocalizedCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const [{ locale, category }, query] = await Promise.all([params, searchParams]);
  if (locale !== "zh" && locale !== "ja" && locale !== "fr") notFound();
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
  const pathname = localizePath(`/categories/${match.value}`, locale);
  const title = categorySeoTitle(match.value, locale);

  return (
    <LobsterCollectionPage
      locale={locale}
      pathLocale={locale}
      title={title}
      intro={categoryIntro(match.value, locale)}
      pathname={pathname}
      result={result}
      sort={sort}
      selectedCategory={match.value}
      sectionHeading={title}
      guideSlugs={categoryGuideSlugs(match.value)}
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
