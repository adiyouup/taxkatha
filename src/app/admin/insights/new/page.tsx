import type { Metadata } from "next";

import { InsightEditor } from "@/components/admin/insight-editor";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EMPTY_DOC } from "@/lib/rich-text/schema";
import { requireRolePage } from "@/server/auth/dal";
import { listTopicOptions } from "@/server/queries/insights";

export const metadata: Metadata = { title: "New insight" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

export default async function NewInsightPage() {
  await requireRolePage("admin", "/admin/insights/new");
  const topics = await listTopicOptions();

  return (
    <>
      <AdminPageHeader crumbs={[{ label: "Insights", href: "/admin/insights" }, { label: "New" }]} title="New insight" />
      <InsightEditor
        topics={topics}
        initial={{
          id: null,
          title: "",
          slug: "",
          excerpt: "",
          body: EMPTY_DOC,
          coverImageUrl: null,
          coverImageAlt: "",
          topicId: null,
          domain: "gst",
          seoTitle: "",
          seoDescription: "",
          membersOnly: false,
          status: "draft",
          publishedAt: null,
        }}
      />
    </>
  );
}
