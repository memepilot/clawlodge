import type { Metadata } from "next";

import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy notes for ClawLodge, including stored data, uploads, and support contact routes.",
  alternates: {
    canonical: absoluteUrl("/privacy"),
  },
};

export default function PrivacyPage() {
  return (
    <div className="page-shell">
      <section className="shell page-panel p-6 md:p-8">
        <p className="field-label">Privacy</p>
        <h1 className="page-title mt-3">Privacy and data handling</h1>
        <div className="mt-5 stack-md">
          <p className="page-subtitle">
            ClawLodge stores account data, published workspace metadata, comments, and uploaded assets needed to render
            public workspace pages and version downloads.
          </p>
          <p className="page-subtitle">
            CLI publishing uses personal access tokens. Uploaded assets and generated README assets are stored on the
            server so published pages remain stable even when source repositories change.
          </p>
          <p className="page-subtitle">
            For project issues, privacy questions, or removal requests, use the repository issue tracker at{" "}
            <a className="inline-link" href={`${siteConfig.githubUrl}/issues`} target="_blank" rel="noreferrer">
              {siteConfig.githubUrl}/issues
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
