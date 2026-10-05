import "server-only";

import { and, desc, eq, lte, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { richDocSchema, type RichDoc } from "@/lib/rich-text/schema";
import { postTag, TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { insightDetails, postStats, posts, topics, user } from "@/server/db/schema";

const isLive = and(eq(posts.status, "published"), lte(posts.publishedAt, sql`now()`));

export type InsightTeaser = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date;
  updatedAt: Date;
  topic: { name: string; slug: string } | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  readingMinutes: number;
  authorName: string | null;
  membersOnly: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  stats: { likes: number; comments: number };
};

/** Everything PUBLIC about an insight: never the body of a members-only one. */
export async function getInsight(slug: string): Promise<InsightTeaser | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.posts, postTag(slug));

  const [row] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      topicName: topics.name,
      topicSlug: topics.slug,
      topicReviewed: topics.reviewed,
      coverImageUrl: insightDetails.coverImageUrl,
      coverImageAlt: insightDetails.coverImageAlt,
      readingMinutes: insightDetails.readingMinutes,
      membersOnly: insightDetails.membersOnly,
      seoTitle: insightDetails.seoTitle,
      seoDescription: insightDetails.seoDescription,
      authorName: user.name,
      likeCount: postStats.likeCount,
      commentCount: postStats.commentCount,
    })
    .from(posts)
    .innerJoin(insightDetails, eq(insightDetails.postId, posts.id))
    .leftJoin(postStats, eq(postStats.postId, posts.id))
    .leftJoin(topics, eq(topics.id, posts.topicId))
    .leftJoin(user, eq(user.id, insightDetails.authorId))
    .where(and(isLive, eq(posts.type, "insight"), eq(posts.slug, slug)))
    .limit(1);
  if (!row || !row.publishedAt) return null;

  cacheTag(postTag(row.id));
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    topic: row.topicName && row.topicSlug && row.topicReviewed ? { name: row.topicName, slug: row.topicSlug } : null,
    coverImageUrl: row.coverImageUrl,
    coverImageAlt: row.coverImageAlt,
    readingMinutes: row.readingMinutes,
    authorName: row.authorName,
    membersOnly: row.membersOnly,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    stats: { likes: row.likeCount ?? 0, comments: row.commentCount ?? 0 },
  };
}

/**
 * The article body. For a members-only insight this is GATED text: call it
 * only after verifying a session.
 */
export async function getInsightBody(postId: string): Promise<RichDoc | null> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.posts, postTag(postId));

  const [row] = await db
    .select({ bodyJson: insightDetails.bodyJson })
    .from(insightDetails)
    .innerJoin(posts, eq(posts.id, insightDetails.postId))
    .where(and(isLive, eq(insightDetails.postId, postId)))
    .limit(1);
  if (!row) return null;
  // Stored documents were validated on save; validating again on read means a
  // bad row can never render as anything but an empty article.
  const parsed = richDocSchema.safeParse(row.bodyJson);
  return parsed.success ? parsed.data : null;
}

/* ---------------------------------- admin --------------------------------- */

/** Admin list. Callers must have passed requireRolePage("admin"). */
export async function listInsightsAdmin() {
  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
      membersOnly: insightDetails.membersOnly,
      readingMinutes: insightDetails.readingMinutes,
      authorName: user.name,
      likeCount: postStats.likeCount,
      commentCount: postStats.commentCount,
      viewCount: postStats.viewCount,
    })
    .from(posts)
    .innerJoin(insightDetails, eq(insightDetails.postId, posts.id))
    .leftJoin(postStats, eq(postStats.postId, posts.id))
    .leftJoin(user, eq(user.id, insightDetails.authorId))
    .where(eq(posts.type, "insight"))
    .orderBy(desc(posts.updatedAt))
    .limit(200);
}

export async function getInsightForEdit(id: string) {
  const [row] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      status: posts.status,
      publishedAt: posts.publishedAt,
      topicId: posts.topicId,
      domain: posts.domain,
      bodyJson: insightDetails.bodyJson,
      coverImageUrl: insightDetails.coverImageUrl,
      coverImageAlt: insightDetails.coverImageAlt,
      seoTitle: insightDetails.seoTitle,
      seoDescription: insightDetails.seoDescription,
      membersOnly: insightDetails.membersOnly,
    })
    .from(posts)
    .innerJoin(insightDetails, eq(insightDetails.postId, posts.id))
    .where(and(eq(posts.id, id), eq(posts.type, "insight")))
    .limit(1);
  return row ?? null;
}

export async function listTopicOptions() {
  return db.select({ id: topics.id, name: topics.name }).from(topics).where(eq(topics.reviewed, true)).orderBy(topics.sortOrder, topics.name);
}
