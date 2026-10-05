import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailList } from "@/components/admin/admin-ui";
import { CaseEditor } from "@/components/admin/case-editor";
import { PostStatusBadge } from "@/components/admin/post-status";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { isUuid } from "@/lib/admin-params";
import { formatDateTime, formatNumber } from "@/lib/format";
import { requireRolePage } from "@/server/auth/dal";
import { getCaseForEdit, getPostHistory, listAllTopicOptions, listCourtOptions } from "@/server/queries/admin-posts";

export const metadata: Metadata = { title: "Edit ruling" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

export default async function EditCasePage({ params }: PageProps<"/admin/case-laws/[id]">) {
  const { id } = await params;
  await requireRolePage("admin", `/admin/case-laws/${id}`);
  if (!isUuid(id)) notFound();

  const [item, courts, topics, history] = await Promise.all([getCaseForEdit(id), listCourtOptions(), listAllTopicOptions(), getPostHistory(id)]);
  if (!item) notFound();
  const status = item.status === "scheduled" ? "draft" : item.status;

  return (
    <>
      <AdminPageHeader
        title={<span className="line-clamp-2">{item.title}</span>}
        crumbs={[{ label: "Case laws", href: "/admin/case-laws" }, { label: "Edit" }]}
        actions={<PostStatusBadge status={item.status} />}
      />

      <CaseEditor
        initial={{
          id: item.id,
          title: item.title,
          slug: item.slug,
          status,
          courtId: item.courtId,
          bench: item.bench,
          decisionDate: item.decisionDate,
          caseNumber: item.caseNumber,
          relevantSections: item.relevantSections,
          sectionRefs: item.sectionRefs,
          excerpt: item.excerpt,
          background: item.background,
          decision: item.decision,
          outcomeSide: item.outcomeSide,
          remanded: item.remanded,
          topicId: item.topicId,
          domain: item.domain,
          domainLabel: item.domainLabel,
          locked: item.manuallyEditedAt !== null,
        }}
        courts={courts}
        topics={topics}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminCard title="Engagement">
          <DetailList
            items={[
              { label: "Views", value: formatNumber(item.views ?? 0) },
              { label: "Likes", value: formatNumber(item.likes ?? 0) },
              { label: "Comments", value: formatNumber(item.comments ?? 0) },
              { label: "Saves", value: formatNumber(item.saves ?? 0) },
              { label: "Shares", value: formatNumber(item.shares ?? 0) },
              { label: "Featured", value: item.boostRank !== null ? `Yes — position ${item.boostRank}` : "No" },
            ]}
          />
        </AdminCard>
        <AdminCard title="Source">
          <DetailList
            items={[
              {
                label: "Imported from",
                value: item.importBatchId ? (
                  <Link href={`/admin/import/${item.importBatchId}`} className="font-semibold text-gold-text hover:underline">
                    {item.importFilename ?? "a workbook"}
                  </Link>
                ) : (
                  "Added by hand"
                ),
              },
              { label: "Imported on", value: item.importedAt ? formatDateTime(item.importedAt) : "—" },
              { label: "Court as written", value: item.courtRaw },
              { label: "Outcome as written", value: item.outcomeRaw || "—" },
              { label: "Protected from imports", value: item.manuallyEditedAt ? `Since ${formatDateTime(item.manuallyEditedAt)}` : "No" },
              { label: "TaxKatha ID", value: <code className="text-xs">{item.id}</code> },
            ]}
          />
        </AdminCard>
      </div>

      <AdminCard title="History" description="Changes made in the admin and by imports" className="mt-6">
        {history.length === 0 ? (
          <p className="type-small text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <ol className="space-y-3.5">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b pb-3.5 last:border-0 last:pb-0">
                <p className="text-sm text-foreground">{entry.summary}</p>
                <p className="type-caption text-muted-foreground">
                  {entry.actor ?? "System"} · {formatDateTime(entry.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </AdminCard>
    </>
  );
}
