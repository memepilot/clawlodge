export const siteConfig = {
  name: "ClawLodge",
  title: "ClawLodge | The OpenClaw Agent Zoo",
  description:
    "Discover, inspect, and publish powerful OpenClaw setups with README previews, workspace snapshots, and a CLI for local publishing.",
  origin: process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
  githubUrl: "https://github.com/memepilot/clawlodge",
  npmCliUrl: "https://www.npmjs.com/package/clawlodge-cli",
};

export function absoluteUrl(pathname = "/") {
  return new URL(pathname, siteConfig.origin).toString();
}
