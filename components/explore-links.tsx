import Link from "next/link";

import { type Locale } from "@/lib/i18n";
import { localizePath } from "@/lib/locale-routing";

type ExploreRow = {
  label: string;
  items: Array<{
    key: string;
    href: string;
    text: string;
    className?: string;
  }>;
};

export function ExploreLinks({
  locale,
  rows,
}: {
  locale: Locale;
  rows: ExploreRow[];
}) {
  const accessibleLabel =
    locale === "zh" ? "更多浏览入口" : locale === "ja" ? "追加の閲覧リンク" : locale === "fr" ? "Plus de chemins de navigation" : "More browsing links";

  const visibleRows = rows.filter((row) => row.items.length);
  if (!visibleRows.length) return null;

  return (
    <div className="home-explore-links" aria-label={accessibleLabel}>
      {visibleRows.map((row) => (
        <div key={row.label} className="home-explore-row">
          <span className="home-explore-label">{row.label}</span>
          <div className="home-explore-chips">
            {row.items.map((item) => (
              <Link key={item.key} className={item.className ?? "tag home-explore-chip"} href={localizePath(item.href, locale)}>
                {item.text}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
