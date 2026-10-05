import * as z from "zod";

import { isSafeHref } from "@/lib/rich-text/schema";
import { siteConfig } from "@/lib/site";

/*
 * Settings an administrator can change without a deploy. Each section is
 * stored as one row in `site_settings` and validated on the way in and on
 * the way out: a bad or missing row falls back to the defaults below.
 * Shared by the server (reads, saves) and the admin form (limits, hints).
 */

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);

const httpsLink = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === "" || /^https:\/\/[^\s/$.?#][^\s]*$/i.test(value), "Use a full link that starts with https://");

export const SETTINGS_SECTIONS = ["announcement", "hero", "seo", "social", "community"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const settingsSchemas = {
  announcement: z
    .object({
      enabled: z.boolean(),
      text: text(140),
      linkLabel: text(40),
      href: z
        .string()
        .trim()
        .max(300)
        .refine((value) => value === "" || isSafeHref(value), "Use a path on this site (such as /insights) or a full https:// link."),
    })
    .refine((value) => !value.enabled || value.text.length >= 8, { message: "Write the announcement before switching it on.", path: ["text"] })
    .refine((value) => !value.linkLabel || value.href, { message: "Add the link the label should open.", path: ["href"] }),
  hero: z.object({
    eyebrow: text(60),
    headline: text(80).min(8, "Write a headline of at least 8 characters."),
    accent: text(60),
    lede: text(280).min(40, "Write at least 40 characters."),
  }),
  seo: z.object({
    title: text(70).min(10, "Write a title of at least 10 characters."),
    description: text(170).min(50, "Write a description of at least 50 characters."),
  }),
  social: z.object({
    linkedin: httpsLink,
    x: httpsLink,
    instagram: httpsLink,
    youtube: httpsLink,
  }),
  community: z.object({
    blockedWords: z.array(z.string().trim().toLowerCase().min(2).max(40)).max(300, "Keep the list under 300 entries."),
  }),
} as const;

export type SiteSettings = { [K in SettingsSection]: z.infer<(typeof settingsSchemas)[K]> };

export const DEFAULT_SETTINGS: SiteSettings = {
  announcement: { enabled: false, text: "", linkLabel: "", href: "" },
  hero: {
    eyebrow: siteConfig.descriptor,
    headline: "Tax rulings, made simple.",
    accent: "Decisions made smarter.",
    lede: "TaxKatha reads every significant GST and tax ruling and distils it into a clear summary — so you can find the point, understand the decision and act with confidence.",
  },
  seo: {
    title: `${siteConfig.name} — Indian tax rulings, distilled`,
    description: siteConfig.description,
  },
  social: { ...siteConfig.social, youtube: "" },
  community: { blockedWords: [] },
};

export const SETTINGS_LABEL: Record<SettingsSection, string> = {
  announcement: "Announcement bar",
  hero: "Home page hero",
  seo: "Search and sharing",
  social: "Social links",
  community: "Community",
};

/**
 * The first blocked word or phrase found in `text`, matched as a whole word
 * and ignoring case (works for any script, not only English).
 */
export function findBlockedWord(text: string, words: readonly string[]): string | null {
  if (words.length === 0) return null;
  const haystack = text.normalize("NFC").toLowerCase();
  for (const word of words) {
    const escaped = word.normalize("NFC").toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(haystack)) return word;
  }
  return null;
}

/** One entry per line or comma, trimmed, lower-cased and without repeats. */
export function parseWordList(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[\n,]/)
        .map((word) => word.trim().toLowerCase())
        .filter((word) => word.length > 0),
    ),
  ];
}
