import "server-only";

import { eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { DEFAULT_SETTINGS, SETTINGS_SECTIONS, settingsSchemas, type SettingsSection, type SiteSettings } from "@/lib/site-settings";
import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { siteSettings, user } from "@/server/db/schema";

/**
 * The live site settings, cached until an administrator saves a change
 * (the save calls `updateTag(TAGS.settings)`). Public — nothing here is private.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("max");
  cacheTag(TAGS.settings);

  const rows = await db
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings)
    .where(inArray(siteSettings.key, [...SETTINGS_SECTIONS]));

  const settings: SiteSettings = structuredClone(DEFAULT_SETTINGS);
  for (const row of rows) {
    const key = row.key as SettingsSection;
    const parsed = settingsSchemas[key].safeParse(row.value);
    // A row that no longer validates (say, after a schema change) falls back to the default.
    if (parsed.success) Object.assign(settings, { [key]: parsed.data });
  }
  return settings;
}

/** Who last changed each section, for the admin settings page. Callers must be admins. */
export async function getSettingsHistory(): Promise<Partial<Record<SettingsSection, { at: Date; by: string | null }>>> {
  const rows = await db
    .select({ key: siteSettings.key, at: siteSettings.updatedAt, by: user.name })
    .from(siteSettings)
    .leftJoin(user, eq(user.id, siteSettings.updatedBy));
  return Object.fromEntries(rows.map((row) => [row.key, { at: row.at, by: row.by }]));
}
