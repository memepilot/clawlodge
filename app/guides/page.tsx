import Link from "next/link";
import Script from "next/script";

import { getGuides } from "@/lib/guides";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata = {
  title: "OpenClaw Guides",
  description:
    "Practical ClawLodge guides for OpenClaw config files, memory strategy, and multi-agent workspace design.",
  alternates: {
    canonical: absoluteUrl("/guides"),
  },
};

export default function GuidesIndexPage() {
  const guides = getGuides();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "OpenClaw Guides",
    description:
      "Practical ClawLodge guides for OpenClaw config files, memory strategy, and multi-agent workspace design.",
    url: absoluteUrl("/guides"),
  };

  return (
    <div className="page-shell stack-lg">
      <Script
        id="guides-index-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="shell page-panel p-5 md:p-6">
        <div className="detail-kickers">
          <span className="tag tag-topic">Guides</span>
        </div>
        <h1 className="page-title">OpenClaw Guides</h1>
        <p className="page-subtitle">
          Practical guides for inspecting, installing, and understanding OpenClaw setups on {siteConfig.name}.
        </p>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <div className="grid home-lobster-grid">
          {guides.map((guide) => (
            <article key={guide.slug} className="card lobster-card lobster-card-home">
              <div className="lobster-card-header lobster-card-home-header">
                <div className="lobster-card-heading">
                  <h2 className="lobster-card-title lobster-card-home-title">
                    <Link href={`/guides/${guide.slug}`}>{guide.title}</Link>
                  </h2>
                </div>
              </div>
              <p className="lobster-card-summary lobster-card-home-summary">{guide.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
