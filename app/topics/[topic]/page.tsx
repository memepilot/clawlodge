import { notFound } from "next/navigation";

import { LobsterCollectionPage } from "@/components/lobster-collection-page";
import { buildCollectionMetadata, topicIntro, topicSeoTitle } from "@/lib/lobster-taxonomy";
import { getRequestLocale } from "@/lib/server/locale";
import { listLobsters } from "@/lib/server/service";
import type { LobsterTopic } from "@/lib/types";

const TOPICS: LobsterTopic[] = ["dev", "design", "research", "writing", "productivity", "multiagent", "automation"];

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const locale = await getRequestLocale();
  if (!TOPICS.includes(topic as LobsterTopic)) return {};
  const title = topicSeoTitle(topic as LobsterTopic, locale);
  return buildCollectionMetadata({
    title,
    description: topicIntro(topic as LobsterTopic, locale),
    pathname: `/topics/${topic}`,
  });
}

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ topic: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const [{ topic }, query] = await Promise.all([params, searchParams]);
  const locale = await getRequestLocale();
  if (!TOPICS.includes(topic as LobsterTopic)) notFound();
  const sort = query.sort === "new" ? "new" : "hot";
  const page = Number.isFinite(Number(query.page)) ? Math.max(1, Math.floor(Number(query.page))) : 1;
  const result = await listLobsters({
    topic,
    sort,
    page,
    per_page: 18,
  });
  const pathname = `/topics/${topic}`;
  const typedTopic = topic as LobsterTopic;
  const title = topicSeoTitle(typedTopic, locale);

  return (
    <LobsterCollectionPage
      locale={locale}
      title={title}
      intro={topicIntro(typedTopic, locale)}
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
