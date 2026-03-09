export const siteConfig = {
  name: "ClawLodge",
  title: "ClawLodge | OpenClaw Workspace Publishing and Discovery",
  description:
    "Publish, browse, and download OpenClaw workspaces with versioned releases, source links, and a CLI for local publishing.",
  origin: process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
  githubUrl: "https://github.com/memepilot/clawlodge",
  npmCliUrl: "https://www.npmjs.com/package/clawlodge-cli",
};

export function absoluteUrl(pathname = "/") {
  return new URL(pathname, siteConfig.origin).toString();
}
