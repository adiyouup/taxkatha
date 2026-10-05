import { inArray } from "drizzle-orm";

import type { DbOrTx } from "../db";
import { courtAliases, courts, topicAliases, topics } from "../db/schema";
import type { NormalizedCourt } from "./courts";
import { CANONICAL_TOPICS, topicAliasKey, topicSlugForNew } from "./topics";

/** Inserts the curated topics and their aliases if they are not there yet. Admin edits are never overwritten. */
export async function ensureCanonicalTopics(conn: DbOrTx): Promise<void> {
  await conn
    .insert(topics)
    .values(
      CANONICAL_TOPICS.map((t, i) => ({ name: t.name, slug: t.slug, description: t.description, reviewed: true, sortOrder: i })),
    )
    .onConflictDoNothing({ target: topics.slug });

  const rows = await conn
    .select({ id: topics.id, slug: topics.slug })
    .from(topics)
    .where(inArray(topics.slug, CANONICAL_TOPICS.map((t) => t.slug)));
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));

  const aliases = CANONICAL_TOPICS.flatMap((t) => {
    const topicId = idBySlug.get(t.slug);
    if (!topicId) return [];
    return [...new Set([t.name, ...t.aliases].map(topicAliasKey))].map((alias) => ({ alias, topicId }));
  });
  if (aliases.length > 0) await conn.insert(topicAliases).values(aliases).onConflictDoNothing();
}

/** alias key → topic id, as currently stored (includes admin-made aliases). */
export async function loadAliasMap(conn: DbOrTx): Promise<Map<string, string>> {
  const rows = await conn.select().from(topicAliases);
  return new Map(rows.map((r) => [r.alias, r.topicId]));
}

/**
 * Resolves topic labels to ids. Unknown labels become UNREVIEWED topics (kept
 * out of public navigation until an admin approves or merges them).
 */
export async function resolveTopics(
  conn: DbOrTx,
  labels: { key: string; label: string }[],
): Promise<{ map: Map<string, string>; created: string[] }> {
  await ensureCanonicalTopics(conn);
  const map = await loadAliasMap(conn);
  const created: string[] = [];

  const taken = new Set((await conn.select({ slug: topics.slug }).from(topics)).map((r) => r.slug));
  for (const { key, label } of labels) {
    if (map.has(key)) continue;
    let slug = topicSlugForNew(label) || "topic";
    for (let n = 2; taken.has(slug); n++) slug = `${topicSlugForNew(label) || "topic"}-${n}`;
    taken.add(slug);
    const [row] = await conn
      .insert(topics)
      .values({ name: label, slug, reviewed: false, sortOrder: 1000 })
      .returning({ id: topics.id });
    await conn.insert(topicAliases).values({ alias: key, topicId: row!.id }).onConflictDoNothing();
    map.set(key, row!.id);
    created.push(label);
  }
  return { map, created };
}

/**
 * Upserts courts by canonical key and returns key → id. Existing rows (and
 * admin edits) are kept, and keys of merged courts resolve to the court they
 * were merged into.
 */
export async function resolveCourts(conn: DbOrTx, list: NormalizedCourt[]): Promise<Map<string, string>> {
  const byKey = new Map(list.map((c) => [c.key, c]));
  if (byKey.size === 0) return new Map();

  const lookup = async () => {
    const keys = [...byKey.keys()];
    const [direct, merged] = await Promise.all([
      conn.select({ id: courts.id, key: courts.key }).from(courts).where(inArray(courts.key, keys)),
      conn.select({ id: courtAliases.courtId, key: courtAliases.key }).from(courtAliases).where(inArray(courtAliases.key, keys)),
    ]);
    return new Map([...merged, ...direct].map((r) => [r.key, r.id]));
  };

  let found = await lookup();
  const missing = [...byKey.values()].filter((c) => !found.has(c.key));
  if (missing.length > 0) {
    const taken = new Set((await conn.select({ slug: courts.slug }).from(courts)).map((r) => r.slug));
    const values = missing.map((c) => {
      let slug = c.slug;
      for (let n = 2; taken.has(slug); n++) slug = `${c.slug}-${n}`;
      taken.add(slug);
      return { key: c.key, name: c.name, shortName: c.shortName, type: c.type, location: c.location, slug };
    });
    await conn.insert(courts).values(values).onConflictDoNothing({ target: courts.key });
    found = await lookup();
  }
  return found;
}
