import { notFound } from "next/navigation";

import { LobsterCollectionPage } from "@/components/lobster-collection-page";
import { buildCollectionMetadata, topicGuideSlugs, topicIntro, topicSeoTitle } from "@/lib/lobster-taxonomy";
import { localizePath } from "@/lib/locale-routing";
import { listLobsters } from "@/lib/server/service";
import type { LobsterTopic } from "@/lib/types";

const TOPICS: LobsterTopic[] = ["dev", "design", "research", "writing", "productivity", "multiagent", "automation"];

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; topic: string }> }) {
  const { locale, topic } = await params;
  if (locale !== "zh" && locale !== "ja" && locale !== "fr") return {};
  if (!TOPICS.includes(topic as LobsterTopic)) return {};
  const title = topicSeoTitle(topic as LobsterTopic, locale);
  return buildCollectionMetadata({
    title,
    description: topicIntro(topic as LobsterTopic, locale),
    pathname: `/topics/${topic}`,
    locale,
  });
}

export default async function LocalizedTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; topic: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const [{ locale, topic }, query] = await Promise.all([params, searchParams]);
  if (locale !== "zh" && locale !== "ja" && locale !== "fr") notFound();
  if (!TOPICS.includes(topic as LobsterTopic)) notFound();
  const sort = query.sort === "new" ? "new" : "hot";
  const page = Number.isFinite(Number(query.page)) ? Math.max(1, Math.floor(Number(query.page))) : 1;
  const result = await listLobsters({
    topic,
    sort,
    page,
    per_page: 18,
  });
  const pathname = localizePath(`/topics/${topic}`, locale);
  const typedTopic = topic as LobsterTopic;
  const title = topicSeoTitle(typedTopic, locale);

  return (
    <LobsterCollectionPage
      locale={locale}
      pathLocale={locale}
      title={title}
      intro={topicIntro(typedTopic, locale)}
      pathname={pathname}
      result={result}
      sort={sort}
      sectionHeading={title}
      guideSlugs={topicGuideSlugs(typedTopic)}
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
