import { sql } from "drizzle-orm";

import type { DbOrTx } from "../db";

/*
 * Rebuilds the two full-text documents for the given posts.
 *
 *   search_public — title, statutes, court, bench, topic and the PUBLIC
 *                   teaser. Safe for anonymous search and snippets.
 *   search_member — the public document plus gated text (background,
 *                   decision, members-only insight bodies). Only ever
 *                   queried for signed-in members.
 *
 * They are written explicitly (not generated columns) because the text
 * lives across several tables. Call after any write to a post, its details,
 * its court or its topic.
 */
export async function refreshSearchVectors(conn: DbOrTx, postIds: string[]): Promise<void> {
  for (let i = 0; i < postIds.length; i += 500) {
    const ids = postIds.slice(i, i + 500);
    if (ids.length === 0) continue;
    await conn.execute(sql`
      UPDATE posts AS p
      SET search_public = v.public_doc,
          search_member = v.public_doc || v.member_doc
      FROM (
        SELECT
          src.id,
          setweight(to_tsvector('english', coalesce(src.title, '')), 'A')
            || setweight(to_tsvector('english', concat_ws(' ', c.relevant_sections, c.case_number, ct.name, ct.short_name, c.bench, t.name)), 'B')
            || setweight(to_tsvector('english', coalesce(src.excerpt, '')), 'C')
            || setweight(to_tsvector('english', CASE WHEN i.members_only IS FALSE THEN coalesce(i.body_text, '') ELSE '' END), 'D')
            AS public_doc,
          setweight(to_tsvector('english', concat_ws(' ', c.background, c.decision, CASE WHEN i.members_only THEN i.body_text END)), 'D')
            AS member_doc
        FROM posts src
        LEFT JOIN case_law_details c ON c.post_id = src.id
        LEFT JOIN courts ct ON ct.id = c.court_id
        LEFT JOIN insight_details i ON i.post_id = src.id
        LEFT JOIN topics t ON t.id = src.topic_id
        WHERE src.id IN ${ids}
      ) AS v
      WHERE p.id = v.id
    `);
  }
}
