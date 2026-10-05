import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, tsvector, updatedAt } from "./_types";
import { user } from "./auth";
import { importBatches } from "./ops";

/* -------------------------------- Taxonomy -------------------------------- */

export const courtType = pgEnum("court_type", [
  "supreme_court",
  "high_court",
  "gstat",
  "cestat",
  "itat",
  "aaar",
  "aar",
  "naa",
  "tribunal",
  "other",
]);

export const courts = pgTable(
  "courts",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Normalised upper-case key the importer matches on, e.g. "HIGH COURT OF MADRAS". */
    key: text().notNull().unique(),
    name: text().notNull(),
    shortName: text().notNull(),
    type: courtType().notNull().default("other"),
    location: text(),
    slug: text().notNull().unique(),
    /** Optional introduction shown on the court's page. */
    description: text(),
    createdAt: createdAt(),
  },
  (t) => [index("courts_type_idx").on(t.type)],
);

/**
 * Keys of courts that were merged into another court. The importer checks
 * these first, so a merged court is not recreated by the next upload.
 */
export const courtAliases = pgTable(
  "court_aliases",
  {
    key: text().primaryKey(),
    courtId: uuid()
      .notNull()
      .references(() => courts.id, { onDelete: "cascade" }),
  },
  (t) => [index("court_aliases_court_idx").on(t.courtId)],
);

export const topics = pgTable("topics", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  description: text(),
  /** Only reviewed topics are listed publicly; imports create unreviewed ones. */
  reviewed: boolean().notNull().default(false),
  sortOrder: integer().notNull().default(0),
  createdAt: createdAt(),
});

/** Maps raw import labels ("IInterest", "Demand") to a canonical topic. */
export const topicAliases = pgTable("topic_aliases", {
  alias: text().primaryKey(),
  topicId: uuid()
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
});

/* ---------------------------------- Posts --------------------------------- */

export const postType = pgEnum("post_type", ["case_law", "insight"]);
export const postStatus = pgEnum("post_status", ["draft", "scheduled", "published", "archived"]);
export const taxDomain = pgEnum("tax_domain", [
  "gst",
  "income_tax",
  "customs",
  "excise",
  "service_tax",
  "vat",
  "ibc",
  "other",
]);

/**
 * Supertype for everything users can like, save, share and discuss.
 * Only PUBLIC fields live here — gated text is in the detail tables.
 */
export const posts = pgTable(
  "posts",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: postType().notNull(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    /** Public teaser: the headnote for case laws, the standfirst for insights. */
    excerpt: text().notNull().default(""),
    status: postStatus().notNull().default("draft"),
    publishedAt: timestamp({ withTimezone: true }),
    topicId: uuid().references(() => topics.id, { onDelete: "set null" }),
    domain: taxDomain().notNull().default("other"),
    /** Boosted ("featured") posts: lower rank shows first; null = not boosted. */
    boostRank: integer(),
    boostUntil: timestamp({ withTimezone: true }),
    editorNote: text(),
    /** FTS over public fields only — safe for anonymous search and snippets. */
    searchPublic: tsvector(),
    /** FTS including gated text — used only for signed-in members. */
    searchMember: tsvector(),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("posts_status_published_idx").on(t.status, t.publishedAt.desc()),
    index("posts_type_status_idx").on(t.type, t.status),
    index("posts_topic_idx").on(t.topicId),
    index("posts_boost_idx").on(t.boostRank).where(sql`${t.boostRank} is not null`),
    index("posts_search_public_idx").using("gin", t.searchPublic),
    index("posts_search_member_idx").using("gin", t.searchMember),
    index("posts_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")),
  ],
);

/** Narrow counters table so hot counter updates never rewrite wide post rows. */
export const postStats = pgTable("post_stats", {
  postId: uuid()
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  likeCount: integer().notNull().default(0),
  commentCount: integer().notNull().default(0),
  saveCount: integer().notNull().default(0),
  shareCount: integer().notNull().default(0),
  viewCount: integer().notNull().default(0),
});

export const outcomeSide = pgEnum("outcome_side", ["assessee", "revenue", "partly", "unknown"]);

export const caseLawDetails = pgTable(
  "case_law_details",
  {
    postId: uuid()
      .primaryKey()
      .references(() => posts.id, { onDelete: "cascade" }),
    courtId: uuid()
      .notNull()
      .references(() => courts.id),
    courtRaw: text().notNull(),
    bench: text().notNull().default(""),
    decisionDate: date({ mode: "string" }).notNull(),
    caseNumber: text().notNull().default(""),
    relevantSections: text().notNull().default(""),
    /** Parsed tags such as "CGST S.74", "CGST Rules R.142", "Constitution Art.226". */
    sectionRefs: text().array().notNull().default(sql`'{}'::text[]`),
    /** GATED — never select these for anonymous viewers. */
    background: text().notNull().default(""),
    /** GATED — never select these for anonymous viewers. */
    decision: text().notNull().default(""),
    outcomeSide: outcomeSide().notNull().default("unknown"),
    remanded: boolean().notNull().default(false),
    outcomeRaw: text().notNull().default(""),
    /** Label as written in the source, e.g. "GST/Excise". */
    domainLabel: text().notNull().default(""),
    /** Immutable identity: sha256(normalised name | decision date | raw court key). */
    sourceKey: text().notNull().unique(),
    /** Same parties + forum + date (no case number) — flags probable duplicates on import. */
    similarityKey: text().notNull(),
    /** Hash of the current content. */
    contentHash: text().notNull(),
    /** Hash of the content as last written by an import (detects manual edits). */
    lastImportHash: text(),
    importBatchId: uuid().references(() => importBatches.id, { onDelete: "set null" }),
    manuallyEditedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("case_court_idx").on(t.courtId),
    index("case_decision_date_idx").on(t.decisionDate.desc()),
    index("case_outcome_idx").on(t.outcomeSide, t.remanded),
    index("case_section_refs_idx").using("gin", t.sectionRefs),
    index("case_batch_idx").on(t.importBatchId),
    index("case_similarity_idx").on(t.similarityKey),
  ],
);

export type RichTextDoc = { type: "doc"; content?: unknown[] };

export const insightDetails = pgTable("insight_details", {
  postId: uuid()
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  bodyJson: jsonb().$type<RichTextDoc>().notNull(),
  /** Plain text of the body, for search and reading time. */
  bodyText: text().notNull().default(""),
  coverImageUrl: text(),
  coverImageAlt: text(),
  readingMinutes: integer().notNull().default(1),
  authorId: text().references(() => user.id, { onDelete: "set null" }),
  seoTitle: text(),
  seoDescription: text(),
  /** When true the body is gated behind sign-in, like a case law's analysis. */
  membersOnly: boolean().notNull().default(false),
});

/** Case laws (or other insights) an insight links to, in editorial order. */
export const insightRelatedPosts = pgTable(
  "insight_related_posts",
  {
    insightPostId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    relatedPostId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    position: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.insightPostId, t.relatedPostId] })],
);

/** Old slugs keep working (301) after a post is renamed. */
export const slugHistory = pgTable(
  "slug_history",
  {
    oldSlug: text().primaryKey(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("slug_history_post_idx").on(t.postId)],
);

/** Snapshots taken before an import or admin edit overwrites a post. */
export const postRevisions = pgTable(
  "post_revisions",
  {
    id: uuid().primaryKey().defaultRandom(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    reason: text().notNull(),
    snapshot: jsonb().$type<Record<string, unknown>>().notNull(),
    actorId: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("post_revisions_post_idx").on(t.postId, t.createdAt.desc())],
);
