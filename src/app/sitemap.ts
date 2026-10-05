import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";
import { getDirectoryFacets, getSitemapPosts } from "@/server/queries/posts";

/** Public pages only. Gated text is never exposed here — entries point at the public teaser pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, facets] = await Promise.all([getSitemapPosts(), getDirectoryFacets()]);
  const url = (path: string) => `${siteConfig.url}${path}`;
  const newest = posts[0]?.updatedAt;

  return [
    { url: url("/"), lastModified: newest, changeFrequency: "daily", priority: 1 },
    { url: url("/case-laws"), lastModified: newest, changeFrequency: "daily", priority: 0.9 },
    { url: url("/topics"), changeFrequency: "weekly", priority: 0.7 },
    { url: url("/courts"), changeFrequency: "weekly", priority: 0.7 },
    ...facets.topics.map((topic) => ({ url: url(`/topics/${topic.slug}`), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...facets.courts.map((court) => ({ url: url(`/courts/${court.slug}`), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...posts.map((post) => ({
      url: url(`/${post.type === "case_law" ? "case-laws" : "insights"}/${post.slug}`),
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: post.type === "insight" ? 0.8 : 0.6,
    })),
  ];
}
