import Link from "next/link";
import Script from "next/script";

import { getGuides } from "@/lib/guides";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n";
import { localizePath } from "@/lib/locale-routing";
import { absoluteUrl, siteConfig } from "@/lib/site";

export function GuidesIndexPage({ locale }: { locale: Locale }) {
  const t = getTranslations(locale);
  const guides = getGuides(locale);
  const pathname = localizePath("/guides", locale);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: locale === "zh" ? "OpenClaw 指南" : locale === "ja" ? "OpenClawガイド" : "OpenClaw Guides",
    description:
      locale === "zh"
        ? "关于 OpenClaw 配置文件、记忆策略和多智能体工作区设计的实用指南。"
        : locale === "ja"
          ? "OpenClawの設定、メモリ戦略、マルチエージェント設計に関する実践ガイド。"
          : "Practical ClawLodge guides for OpenClaw config files, memory strategy, and multi-agent workspace design.",
    url: absoluteUrl(pathname),
  };

  return (
    <div className="page-shell stack-lg">
      <Script
        id={`guides-index-jsonld-${locale}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="shell page-panel p-5 md:p-6">
        <div className="detail-kickers">
          <span className="tag tag-topic">{locale === "zh" ? "指南" : locale === "ja" ? "ガイド" : "Guides"}</span>
        </div>
        <h1 className="page-title">{locale === "zh" ? "OpenClaw 指南" : locale === "ja" ? "OpenClawガイド" : "OpenClaw Guides"}</h1>
        <p className="page-subtitle">
          {locale === "zh"
            ? `在 ${siteConfig.name} 上查看关于 OpenClaw 配置、安装和多智能体协作的实用指南。`
            : locale === "ja"
              ? `${siteConfig.name}でOpenClawの設定、導入、マルチエージェント運用を学ぶための実践ガイド。`
              : `Practical guides for inspecting, installing, and understanding OpenClaw setups on ${siteConfig.name}.`}
        </p>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <div className="grid home-lobster-grid">
          {guides.map((guide) => {
            return (
              <article key={guide.slug} className="card lobster-card lobster-card-home">
                <div className="lobster-card-header lobster-card-home-header">
                  <div className="lobster-card-heading">
                    <h2 className="lobster-card-title lobster-card-home-title">
                      <Link href={localizePath(`/guides/${guide.slug}`, locale)}>{guide.title}</Link>
                    </h2>
                  </div>
                </div>
                <p className="lobster-card-summary lobster-card-home-summary">
                  {guide.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
