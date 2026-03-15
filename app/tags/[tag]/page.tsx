import { LobsterCollectionPage } from "@/components/lobster-collection-page";
import { buildCollectionMetadata } from "@/lib/lobster-taxonomy";
import { getRequestLocale } from "@/lib/server/locale";
import { listLobsters } from "@/lib/server/service";

export const revalidate = 300;

function humanizeTag(tag: string) {
  return tag
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const locale = await getRequestLocale();
  const title = `#${decoded} ${locale === "zh" ? "OpenClaw 配置" : "OpenClaw Setups"}`;
  const description = locale === "zh"
    ? `浏览带有 ${decoded} 标签的 OpenClaw 配置、技能和工作流。`
    : `Browse OpenClaw workspaces, skills, and workflows tagged with ${decoded}.`;
  return buildCollectionMetadata({
    title,
    description,
    pathname: `/tags/${encodeURIComponent(decoded)}`,
  });
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const [{ tag }, query] = await Promise.all([params, searchParams]);
  const locale = await getRequestLocale();
  const decodedTag = decodeURIComponent(tag);
  const sort = query.sort === "new" ? "new" : "hot";
  const page = Number.isFinite(Number(query.page)) ? Math.max(1, Math.floor(Number(query.page))) : 1;
  const result = await listLobsters({
    tag: decodedTag,
    sort,
    page,
    per_page: 18,
  });
  const pathname = `/tags/${encodeURIComponent(decodedTag)}`;
  const title = `#${humanizeTag(decodedTag)} ${locale === "zh" ? "OpenClaw 配置" : "OpenClaw Setups"}`;
  const intro = locale === "zh"
    ? `浏览所有带有 #${decodedTag} 标签的 OpenClaw 配置、技能和工作流。`
    : `Browse every OpenClaw workspace, skill, and workflow tagged with #${decodedTag}.`;

  return (
    <LobsterCollectionPage
      locale={locale}
      title={title}
      intro={intro}
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
