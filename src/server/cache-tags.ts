/*
 * Cache tags for `use cache` reads. Mutations call `updateTag` (Server
 * Actions, read-your-own-writes) or `revalidateTag(tag, "max")` (cron and
 * webhooks) with these.
 */
export const TAGS = {
  /** Any list or count of published posts. */
  posts: "posts",
  /** Topics and courts. */
  taxonomy: "taxonomy",
  /** Trending and featured rails. */
  trending: "trending",
  /** Site-wide totals shown on marketing pages. */
  stats: "stats",
  settings: "settings",
} as const;

export const postTag = (idOrSlug: string) => `post:${idOrSlug}`;
