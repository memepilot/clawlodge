import type { MetadataRoute } from "next";

import { getGuides } from "@/lib/guides";
import { CATEGORY_OPTIONS } from "@/lib/lobster-taxonomy";
import { localizePath } from "@/lib/locale-routing";
import { readMirroredLobsterSummaries, readMirroredUserProfiles } from "@/lib/server/store";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    {
      url: absoluteUrl("/guides"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
  const localizedLocales = ["zh", "ja"] as const;
  const localizedStaticRoutes: MetadataRoute.Sitemap = localizedLocales.flatMap((locale) => [
    {
      url: absoluteUrl(localizePath("/", locale)),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl(localizePath("/about", locale)),
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: absoluteUrl(localizePath("/guides", locale)),
      changeFrequency: "weekly",
      priority: 0.75,
    },
  ]);

  try {
    const lobsters = await readMirroredLobsterSummaries();
    const users = await readMirroredUserProfiles();

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
    const localizedCategoryRoutes: MetadataRoute.Sitemap = localizedLocales.flatMap((locale) =>
      CATEGORY_OPTIONS.map((category) => ({
        url: absoluteUrl(localizePath(`/categories/${category.value}`, locale)),
        changeFrequency: "weekly" as const,
        priority: 0.65,
      })),
    );

    const guideRoutes: MetadataRoute.Sitemap = getGuides().map((guide) => ({
      url: absoluteUrl(`/guides/${guide.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.72,
    }));
    const localizedGuideRoutes: MetadataRoute.Sitemap = localizedLocales.flatMap((locale) =>
      getGuides(locale).map((guide) => ({
        url: absoluteUrl(localizePath(`/guides/${guide.slug}`, locale)),
        changeFrequency: "weekly" as const,
        priority: 0.68,
      })),
    );

    const topicValues = new Set<string>();
    const tagCounts = new Map<string, number>();
    for (const { lobster } of lobsters) {
      for (const topic of lobster.topics ?? []) topicValues.add(topic);
      for (const tag of lobster.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }

    const topicRoutes: MetadataRoute.Sitemap = [...topicValues].sort().map((topic) => ({
      url: absoluteUrl(`/topics/${topic}`),
      changeFrequency: "weekly" as const,
      priority: 0.65,
    }));
    const localizedTopicRoutes: MetadataRoute.Sitemap = localizedLocales.flatMap((locale) =>
      [...topicValues].sort().map((topic) => ({
        url: absoluteUrl(localizePath(`/topics/${topic}`, locale)),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    );

    const tagRoutes: MetadataRoute.Sitemap = [...tagCounts.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .map(([tag]) => ({
        url: absoluteUrl(`/tags/${encodeURIComponent(tag)}`),
        changeFrequency: "weekly" as const,
        priority: 0.55,
      }));

    return [
      ...staticRoutes,
      ...localizedStaticRoutes,
      ...guideRoutes,
      ...localizedGuideRoutes,
      ...categoryRoutes,
      ...localizedCategoryRoutes,
      ...topicRoutes,
      ...localizedTopicRoutes,
      ...tagRoutes,
      ...lobsterRoutes,
      ...userRoutes,
    ];
  } catch (error) {
    console.error("sitemap generation fallback", error);
    return [...staticRoutes, ...localizedStaticRoutes];
  }
}
