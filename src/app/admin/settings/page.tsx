import type { Metadata } from "next";

import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-forms";
import { SETTINGS_LABEL, SETTINGS_SECTIONS, type SettingsSection } from "@/lib/site-settings";
import { requireRolePage } from "@/server/auth/dal";
import { getSettingsHistory, getSiteSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Settings" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const DESCRIPTION: Record<SettingsSection, string> = {
  announcement: "Promote a new insight, an event or a change in the law across the whole site.",
  hero: "The first thing visitors read on the home page.",
  seo: "How the home page appears in Google and when a link to TaxKatha is shared.",
  social: "Your profiles, linked from the footer and from search engines’ knowledge panels.",
  community: "Words that are never allowed in the discussion.",
};

export default async function SettingsPage() {
  await requireRolePage("admin", "/admin/settings");
  const [settings, history] = await Promise.all([getSiteSettings(), getSettingsHistory()]);

  return (
    <>
      <AdminPageHeader title="Settings" description="Site-wide copy and rules. Each section saves on its own and is live as soon as you save it." />
      <div className="space-y-6">
        {SETTINGS_SECTIONS.map((section) => {
          const updated = history[section];
          return (
            <AdminCard key={section} title={SETTINGS_LABEL[section]} description={DESCRIPTION[section]}>
              <SettingsForm section={section} values={settings[section]} updated={updated ? { at: updated.at.toISOString(), by: updated.by } : null} />
            </AdminCard>
          );
        })}
      </div>
    </>
  );
}
