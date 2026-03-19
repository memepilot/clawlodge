export const siteConfig = {
  name: "ClawLodge",
  title: "ClawLodge - Discover OpenClaw Setups, Skills, Agents and Workflows",
  description:
    "Discover OpenClaw setups, reusable skills, agent workflows, and creator-focused automation examples for YouTube, TikTok, and more.",
  origin: process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
  githubUrl: "https://github.com/memepilot/clawlodge",
  xUrl: "https://x.com/realclawlodge",
  npmCliUrl: "https://www.npmjs.com/package/clawlodge-cli",
};

export function absoluteUrl(pathname = "/") {
  return new URL(pathname, siteConfig.origin).toString();
}

export function getDefaultSocialImage() {
  return {
    url: absoluteUrl("/icon.png"),
    width: 512,
    height: 512,
    alt: `${siteConfig.name} logo`,
  };
}

export function buildSocialImages(
  image?: string | { url: string; width?: number; height?: number; alt?: string } | null,
  fallbackAlt?: string,
) {
  if (!image) {
    return [getDefaultSocialImage()];
  }

  if (typeof image === "string") {
    return [
      {
        url: absoluteUrl(image),
        alt: fallbackAlt || `${siteConfig.name} preview image`,
      },
    ];
  }

  return [
    {
      ...image,
      url: absoluteUrl(image.url),
      alt: image.alt || fallbackAlt || `${siteConfig.name} preview image`,
    },
  ];
}
