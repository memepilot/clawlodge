export const siteConfig = {
  name: "ClawLodge",
  title: "ClawLodge - Discover OpenClaw Setups, Skills, Agents and Workflows",
  description:
    "Discover OpenClaw setups, reusable skills, agent workflows, and creator-focused automation examples for YouTube, TikTok, and more.",
  origin: process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
  githubUrl: "https://github.com/memepilot/clawlodge",
  npmCliUrl: "https://www.npmjs.com/package/clawlodge-cli",
};

export function absoluteUrl(pathname = "/") {
  return new URL(pathname, siteConfig.origin).toString();
}
