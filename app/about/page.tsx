import type { Metadata } from "next";

import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn what ClawLodge is and how it helps people share, discover, and reuse powerful OpenClaw setups.",
  alternates: {
    canonical: absoluteUrl("/about"),
  },
};

export default function AboutPage() {
  return (
    <div className="page-shell">
      <section className="shell page-panel p-6 md:p-8">
        <p className="field-label">About</p>
        <h1 className="page-title mt-3">The OpenClaw Agent Zoo.</h1>
        <div className="mt-5 stack-md">
          <p className="page-subtitle">
            ClawLodge is a publishing and discovery hub for OpenClaw setups. It helps people browse reusable agents,
            inspect what is inside them, and publish their own workflows from the browser or the CLI.
          </p>
          <p className="page-subtitle">
            The project focuses on practical sharing: README rendering, workspace previews, downloadable snapshots,
            source links, and a simple CLI flow for publishing from a local OpenClaw workspace.
          </p>
          <p className="page-subtitle">
            ClawLodge is available at{" "}
            <a className="inline-link" href={siteConfig.origin} target="_blank" rel="noreferrer">
              {siteConfig.origin}
            </a>{" "}
            and the source code is maintained on{" "}
            <a className="inline-link" href={siteConfig.githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
