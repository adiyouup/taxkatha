import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InsightEditor } from "@/components/admin/insight-editor";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EMPTY_DOC, richDocSchema } from "@/lib/rich-text/schema";
import { requireRolePage } from "@/server/auth/dal";
import { getInsightForEdit, listTopicOptions } from "@/server/queries/insights";

export const metadata: Metadata = { title: "Edit insight" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditInsightPage({ params }: PageProps<"/admin/insights/[id]">) {
  const { id } = await params;
  await requireRolePage("admin", `/admin/insights/${id}`);
  if (!UUID.test(id)) notFound();

  const [insight, topics] = await Promise.all([getInsightForEdit(id), listTopicOptions()]);
  if (!insight) notFound();
  const body = richDocSchema.safeParse(insight.bodyJson);

  return (
    <>
      <AdminPageHeader crumbs={[{ label: "Insights", href: "/admin/insights" }, { label: "Edit" }]} title={insight.title} />
      <InsightEditor
        key={insight.id}
        topics={topics}
        initial={{
          id: insight.id,
          title: insight.title,
          slug: insight.slug,
          excerpt: insight.excerpt,
          body: body.success ? body.data : EMPTY_DOC,
          coverImageUrl: insight.coverImageUrl,
          coverImageAlt: insight.coverImageAlt ?? "",
          topicId: insight.topicId,
          domain: insight.domain,
          seoTitle: insight.seoTitle ?? "",
          seoDescription: insight.seoDescription ?? "",
          membersOnly: insight.membersOnly,
          status: insight.status,
          publishedAt: insight.publishedAt?.toISOString() ?? null,
        }}
      />
    </>
  );
}
