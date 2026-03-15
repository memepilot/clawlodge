import type { MetadataRoute } from "next";

import { CATEGORY_OPTIONS } from "@/lib/lobster-taxonomy";
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

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORY_OPTIONS.map((category) => ({
    url: absoluteUrl(`/categories/${category.value}`),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const topicValues = new Set<string>();
  const tagValues = new Set<string>();
  for (const { lobster } of lobsters) {
    for (const topic of lobster.topics ?? []) topicValues.add(topic);
    for (const tag of lobster.tags ?? []) tagValues.add(tag);
  }

  const topicRoutes: MetadataRoute.Sitemap = [...topicValues].sort().map((topic) => ({
    url: absoluteUrl(`/topics/${topic}`),
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  const tagRoutes: MetadataRoute.Sitemap = [...tagValues].sort().slice(0, 250).map((tag) => ({
    url: absoluteUrl(`/tags/${encodeURIComponent(tag)}`),
    changeFrequency: "weekly" as const,
    priority: 0.55,
  }));

  return [...staticRoutes, ...categoryRoutes, ...topicRoutes, ...tagRoutes, ...lobsterRoutes, ...userRoutes];
}
