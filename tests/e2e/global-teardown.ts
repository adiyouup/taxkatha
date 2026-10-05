import { Pool } from "pg";

import "./helpers";

/** Removes the accounts and articles the suite created, so the local database stays as seeded. */
export default async function globalTeardown() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(`DELETE FROM posts WHERE type = 'insight' AND title LIKE 'E2E insight %'`);
    await pool.query(`DELETE FROM comments WHERE user_id IN (SELECT id FROM "user" WHERE email LIKE 'e2e.%@taxkatha.test')`);
    await pool.query(`DELETE FROM "user" WHERE email LIKE 'e2e.%@taxkatha.test'`);
    // Their likes and saves went with them; bring the public counters back in line.
    await pool.query(`
      UPDATE post_stats s SET
        like_count = (SELECT count(*) FROM post_likes l WHERE l.post_id = s.post_id),
        save_count = (SELECT count(*) FROM post_saves v WHERE v.post_id = s.post_id),
        comment_count = (SELECT count(*) FROM comments c WHERE c.post_id = s.post_id AND c.status <> 'deleted')
      WHERE s.like_count <> (SELECT count(*) FROM post_likes l WHERE l.post_id = s.post_id)
         OR s.save_count <> (SELECT count(*) FROM post_saves v WHERE v.post_id = s.post_id)
         OR s.comment_count <> (SELECT count(*) FROM comments c WHERE c.post_id = s.post_id AND c.status <> 'deleted')`);
  } finally {
    await pool.end();
  }
}
