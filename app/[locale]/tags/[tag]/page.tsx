import { notFound } from "next/navigation";

import { LobsterCollectionPage } from "@/components/lobster-collection-page";
import { buildCollectionMetadata, tagSeoTitle } from "@/lib/lobster-taxonomy";
import { localizePath } from "@/lib/locale-routing";
import { listLobsters } from "@/lib/server/service";
import { readMirroredLobsterSummaries } from "@/lib/server/store";

export const revalidate = 300;

function humanizeTag(tag: string) {
  return tag
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; tag: string }> }) {
  const { locale, tag } = await params;
  if (locale !== "zh" && locale !== "ja") return {};
  const decoded = decodeURIComponent(tag);
  const summaries = await readMirroredLobsterSummaries();
  const normalizedTag = decoded.trim().toLowerCase();
  const exists = summaries.some(({ lobster }) => lobster.status === "active" && lobster.tags.includes(normalizedTag));
  if (!exists) return {};
  const title = tagSeoTitle(decoded, locale);
  const description =
    locale === "zh"
      ? `浏览带有 ${decoded} 标签的 OpenClaw 配置、技能和工作流。`
      : `Browse OpenClaw workspaces, skills, and workflows tagged with ${decoded}.`;
  return buildCollectionMetadata({
    title,
    description,
    pathname: `/tags/${encodeURIComponent(decoded)}`,
    locale,
  });
}

export default async function LocalizedTagPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; tag: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const [{ locale, tag }, query] = await Promise.all([params, searchParams]);
  if (locale !== "zh" && locale !== "ja") notFound();
  const decodedTag = decodeURIComponent(tag);
  const summaries = await readMirroredLobsterSummaries();
  const normalizedTag = decodedTag.trim().toLowerCase();
  const exists = summaries.some(({ lobster }) => lobster.status === "active" && lobster.tags.includes(normalizedTag));
  if (!exists) notFound();
  const sort = query.sort === "new" ? "new" : "hot";
  const page = Number.isFinite(Number(query.page)) ? Math.max(1, Math.floor(Number(query.page))) : 1;
  const result = await listLobsters({
    tag: normalizedTag,
    sort,
    page,
    per_page: 18,
  });
  const pathname = localizePath(`/tags/${encodeURIComponent(decodedTag)}`, locale);
  const title = tagSeoTitle(humanizeTag(decodedTag), locale);
  const intro =
    locale === "zh"
      ? `浏览所有带有 #${decodedTag} 标签的 OpenClaw 配置、技能和工作流。`
      : locale === "ja"
        ? `#${decodedTag} タグが付いた OpenClaw の設定、スキル、ワークフローをまとめて確認できます。`
        : `Browse every OpenClaw workspace, skill, and workflow tagged with #${decodedTag}.`;

  return (
    <LobsterCollectionPage
      locale={locale}
      pathLocale={locale}
      title={title}
      intro={intro}
      pathname={pathname}
      result={result}
      sort={sort}
      guideSlugs={["openclaw-config-file"]}
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
