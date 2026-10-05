import type { Metadata } from "next";

import { FeaturedManager, type FeaturedItem } from "@/components/admin/featured-manager";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatDate } from "@/lib/format";
import { requireRolePage } from "@/server/auth/dal";
import { listFeaturedAdmin } from "@/server/queries/admin-posts";

export const metadata: Metadata = { title: "Featured" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

export default async function FeaturedPage() {
  await requireRolePage("admin", "/admin/featured");
  const rows = await listFeaturedAdmin();

  const items: FeaturedItem[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    live: row.live,
    expired: row.expired,
    until: row.until,
    note: row.editorNote ?? "",
    meta: row.type === "case_law" ? [row.court, row.decisionDate ? formatDate(row.decisionDate) : null].filter(Boolean).join(" · ") : "Insight",
  }));

  return (
    <>
      <AdminPageHeader
        title="Featured"
        description="Boost the rulings and insights you want every visitor to see first. Set an end date for time-sensitive posts and they drop off on their own."
      />
      <FeaturedManager items={items} />
    </>
  );
}
