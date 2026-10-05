"use server";

import "server-only";

import { updateTag } from "next/cache";

import { parseWordList, SETTINGS_LABEL, SETTINGS_SECTIONS, settingsSchemas, type SettingsSection } from "@/lib/site-settings";
import { writeAudit } from "@/server/audit";
import { guard } from "@/server/auth/guard";
import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { siteSettings } from "@/server/db/schema";

export type SettingsFormState = { error: string | null; field: string | null; savedAt: number | null };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function readSection(section: SettingsSection, formData: FormData): unknown {
  switch (section) {
    case "announcement":
      return { enabled: formData.get("enabled") === "on", text: text(formData, "text"), linkLabel: text(formData, "linkLabel"), href: text(formData, "href") };
    case "hero":
      return { eyebrow: text(formData, "eyebrow"), headline: text(formData, "headline"), accent: text(formData, "accent"), lede: text(formData, "lede") };
    case "seo":
      return { title: text(formData, "title"), description: text(formData, "description") };
    case "social":
      return { linkedin: text(formData, "linkedin"), x: text(formData, "x"), instagram: text(formData, "instagram"), youtube: text(formData, "youtube") };
    case "community":
      return { blockedWords: parseWordList(text(formData, "blockedWords")) };
  }
}

/** Saves one section of the site settings. Bound to a section by the form. */
export async function saveSettings(section: SettingsSection, _prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  if (!(SETTINGS_SECTIONS as readonly string[]).includes(section)) return { error: "Unknown settings section.", field: null, savedAt: null };
  const auth = await guard("admin");
  if (!auth.ok) return { error: auth.result.ok ? null : auth.result.error, field: null, savedAt: null };

  const parsed = settingsSchemas[section].safeParse(readSection(section, formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Please check the form.", field: issue?.path[0]?.toString() ?? null, savedAt: null };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(siteSettings)
      .values({ key: section, value: parsed.data, updatedBy: auth.viewer.id, updatedAt: now })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: parsed.data, updatedBy: auth.viewer.id, updatedAt: now } });
    await writeAudit(tx, {
      actorId: auth.viewer.id,
      action: "settings.update",
      entityType: "settings",
      entityId: section,
      summary: `Updated ${SETTINGS_LABEL[section].toLowerCase()}`,
      meta: { value: parsed.data },
    });
  });

  updateTag(TAGS.settings);
  return { error: null, field: null, savedAt: now.getTime() };
}
