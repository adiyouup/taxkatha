import "server-only";

import { sql } from "drizzle-orm";

import type { CourtType } from "@/lib/labels";
import { db } from "@/server/db";

/* Admin-only reads for topics and courts. Callers must have checked the admin role. */

export type AdminTopic = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  reviewed: boolean;
  posts: number;
  published: number;
  aliases: string[];
};

export async function listTopicsAdmin(): Promise<AdminTopic[]> {
  const result = await db.execute<AdminTopic>(sql`
    SELECT t.id, t.name, t.slug, t.description, t.reviewed,
      (SELECT count(*) FROM posts p WHERE p.topic_id = t.id)::int AS posts,
      (SELECT count(*) FROM posts p WHERE p.topic_id = t.id AND p.status = 'published')::int AS published,
      coalesce((SELECT array_agg(a.alias ORDER BY a.alias) FROM topic_aliases a WHERE a.topic_id = t.id), '{}') AS aliases
    FROM topics t
    ORDER BY t.reviewed, t.name
  `);
  return result.rows;
}

export type AdminCourt = {
  id: string;
  key: string;
  name: string;
  shortName: string;
  type: CourtType;
  location: string | null;
  slug: string;
  description: string | null;
  rulings: number;
  aliases: string[];
};

export async function listCourtsAdmin(): Promise<AdminCourt[]> {
  const result = await db.execute<AdminCourt>(sql`
    SELECT c.id, c.key, c.name, c.short_name AS "shortName", c.type, c.location, c.slug, c.description,
      (SELECT count(*) FROM case_law_details d WHERE d.court_id = c.id)::int AS rulings,
      coalesce((SELECT array_agg(a.key ORDER BY a.key) FROM court_aliases a WHERE a.court_id = c.id), '{}') AS aliases
    FROM courts c
    ORDER BY c.type, c.name
  `);
  return result.rows;
}
