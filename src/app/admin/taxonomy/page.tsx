import type { Metadata } from "next";

import { AdminTabs } from "@/components/admin/admin-ui";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CourtManager, TopicManager } from "@/components/admin/taxonomy-manager";
import { oneOf } from "@/lib/admin-params";
import { requireRolePage } from "@/server/auth/dal";
import { listCourtsAdmin, listTopicsAdmin } from "@/server/queries/admin-taxonomy";

export const metadata: Metadata = { title: "Topics and courts" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

export default async function TaxonomyPage({ searchParams }: PageProps<"/admin/taxonomy">) {
  await requireRolePage("admin", "/admin/taxonomy");
  const tab = oneOf(await searchParams, "tab", ["topics", "courts"] as const) ?? "topics";
  const [topics, courts] = await Promise.all([listTopicsAdmin(), listCourtsAdmin()]);
  const unreviewed = topics.filter((t) => !t.reviewed).length;

  return (
    <>
      <AdminPageHeader
        title="Topics and courts"
        description={
          unreviewed > 0
            ? `Rename, describe and merge the subjects and forums that organise the directory. ${unreviewed} new topic${unreviewed === 1 ? " needs" : "s need"} review.`
            : "Rename, describe and merge the subjects and forums that organise the directory. Changes apply to every ruling at once."
        }
      />
      <AdminTabs
        label="Taxonomy"
        tabs={[
          { href: "/admin/taxonomy", label: "Topics", count: topics.length, active: tab === "topics" },
          { href: "/admin/taxonomy?tab=courts", label: "Courts", count: courts.length, active: tab === "courts" },
        ]}
      />
      {tab === "topics" ? <TopicManager topics={topics} /> : <CourtManager courts={courts} />}
    </>
  );
}
