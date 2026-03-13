import type { MetadataRoute } from "next";

import { readMirroredLobsterSummaries, readMirroredUserProfiles } from "@/lib/server/store";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [lobsters, users] = await Promise.all([
    readMirroredLobsterSummaries(),
    readMirroredUserProfiles(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: absoluteUrl("/about"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/privacy"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/publish"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/mcp"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const lobsterRoutes: MetadataRoute.Sitemap = lobsters.map(({ lobster }) => ({
      url: absoluteUrl(`/lobsters/${lobster.slug}`),
      lastModified: new Date(lobster.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const userRoutes: MetadataRoute.Sitemap = users.map((user) => ({
    url: absoluteUrl(`/u/${user.handle}`),
    lastModified: new Date(user.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...lobsterRoutes, ...userRoutes];
}
