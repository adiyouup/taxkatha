import { sql } from "drizzle-orm";
import { date, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { createdAt } from "./_types";
import { user } from "./auth";
import { posts } from "./content";

/* ----------------------------- Likes and saves ----------------------------- */

export const postLikes = pgTable(
  "post_likes",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index("post_likes_post_idx").on(t.postId, t.createdAt)],
);

export const postSaves = pgTable(
  "post_saves",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index("post_saves_user_idx").on(t.userId, t.createdAt.desc())],
);

/* -------------------------------- Comments -------------------------------- */

export const commentStatus = pgEnum("comment_status", ["visible", "hidden", "deleted"]);

/**
 * Threads are two levels deep, like Instagram: a top-level comment
 * (root_id null) and replies (root_id = the top-level comment). A reply to a
 * reply stays in the same thread and records who it answers.
 */
export const comments = pgTable(
  "comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    /** Null once the author has deleted their account (the comment is erased but its slot remains). */
    userId: text().references(() => user.id, { onDelete: "set null" }),
    rootId: uuid().references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
    replyToUserId: text().references(() => user.id, { onDelete: "set null" }),
    body: text().notNull(),
    status: commentStatus().notNull().default("visible"),
    likeCount: integer().notNull().default(0),
    replyCount: integer().notNull().default(0),
    editedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("comments_post_top_idx").on(t.postId, t.createdAt.desc()).where(sql`${t.rootId} is null`),
    index("comments_root_idx").on(t.rootId, t.createdAt),
    index("comments_user_idx").on(t.userId, t.createdAt.desc()),
    index("comments_status_idx").on(t.status, t.createdAt.desc()),
  ],
);

export const commentLikes = pgTable(
  "comment_likes",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    commentId: uuid()
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] }), index("comment_likes_comment_idx").on(t.commentId)],
);

/* --------------------------------- Reports -------------------------------- */

export const reportReason = pgEnum("report_reason", ["spam", "abuse", "misinformation", "off_topic", "other"]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);

export const reports = pgTable(
  "reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    commentId: uuid()
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    reporterId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: reportReason().notNull(),
    note: text(),
    status: reportStatus().notNull().default("open"),
    resolvedBy: text().references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reports_once_per_user").on(t.commentId, t.reporterId),
    index("reports_status_idx").on(t.status, t.createdAt.desc()),
  ],
);

/* ---------------------------- Shares and views ---------------------------- */

export const shareChannel = pgEnum("share_channel", [
  "native",
  "whatsapp",
  "linkedin",
  "x",
  "telegram",
  "email",
  "copy_link",
  "story_card",
  "square_card",
]);

export const shareEvents = pgTable(
  "share_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text().references(() => user.id, { onDelete: "set null" }),
    /** Anonymous visitors are counted once per day per salted hash. */
    visitorHash: text(),
    channel: shareChannel().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("share_events_post_idx").on(t.postId, t.createdAt), index("share_events_channel_idx").on(t.channel)],
);

/** Daily view totals — the only views data trending needs. */
export const postViewsDaily = pgTable(
  "post_views_daily",
  {
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    day: date({ mode: "string" }).notNull(),
    views: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.day] }), index("post_views_day_idx").on(t.day)],
);

/** One row per visitor per post per day; purged after a few days by cron. */
export const viewDedupe = pgTable(
  "view_dedupe",
  {
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    day: date({ mode: "string" }).notNull(),
    visitorHash: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.day, t.visitorHash] }), index("view_dedupe_day_idx").on(t.day)],
);

/* ------------------------------ Notifications ----------------------------- */

export const notificationType = pgEnum("notification_type", ["reply", "comment_like", "official_reply"]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    actorId: text().references(() => user.id, { onDelete: "cascade" }),
    type: notificationType().notNull(),
    postId: uuid().references(() => posts.id, { onDelete: "cascade" }),
    commentId: uuid().references(() => comments.id, { onDelete: "cascade" }),
    readAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt.desc())],
);
