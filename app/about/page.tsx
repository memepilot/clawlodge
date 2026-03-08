import type { Metadata } from "next";

import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn what ClawLodge is, what it publishes, and how it helps people share and discover OpenClaw workspaces.",
  alternates: {
    canonical: absoluteUrl("/about"),
  },
};

export default function AboutPage() {
  return (
    <div className="page-shell">
      <section className="shell page-panel p-6 md:p-8">
        <p className="field-label">About</p>
        <h1 className="page-title mt-3">OpenClaw workspaces, published and searchable.</h1>
        <div className="mt-5 stack-md">
          <p className="page-subtitle">
            ClawLodge is a publishing and discovery hub for OpenClaw workspaces. It helps people browse reusable
            configs, inspect what is inside them, track versions, and publish updates from the browser or the CLI.
          </p>
          <p className="page-subtitle">
            The project focuses on practical workspace sharing: README rendering, versioned downloads, source links,
            workspace file previews, and a CLI flow for local packing and publishing.
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
