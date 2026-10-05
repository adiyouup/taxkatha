import type { Metadata } from "next";

import { CaseEditor } from "@/components/admin/case-editor";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireRolePage } from "@/server/auth/dal";
import { listAllTopicOptions, listCourtOptions } from "@/server/queries/admin-posts";

export const metadata: Metadata = { title: "Add a ruling" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

export default async function NewCasePage() {
  await requireRolePage("admin", "/admin/case-laws/new");
  const [courts, topics] = await Promise.all([listCourtOptions(), listAllTopicOptions()]);

  return (
    <>
      <AdminPageHeader
        title="Add a ruling"
        description="For a single ruling. To add many at once, import a workbook instead."
        crumbs={[{ label: "Case laws", href: "/admin/case-laws" }, { label: "New" }]}
      />
      <CaseEditor
        initial={{
          id: null,
          title: "",
          slug: "",
          status: "draft",
          courtId: "",
          bench: "",
          decisionDate: "",
          caseNumber: "",
          relevantSections: "",
          sectionRefs: [],
          excerpt: "",
          background: "",
          decision: "",
          outcomeSide: "unknown",
          remanded: false,
          topicId: null,
          domain: "gst",
          domainLabel: "GST",
          locked: true,
        }}
        courts={courts}
        topics={topics}
      />
    </>
  );
}
