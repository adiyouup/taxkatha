import type { Metadata } from "next";
import Link from "next/link";
import { PenLine, Plus } from "lucide-react";

import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatNumber } from "@/lib/format";
import { requireRolePage } from "@/server/auth/dal";
import { listInsightsAdmin } from "@/server/queries/insights";

export const metadata: Metadata = { title: "Insights" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const STATUS = {
  draft: { label: "Draft", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "gold" },
  published: { label: "Published", variant: "navy" },
  archived: { label: "Archived", variant: "outline" },
} as const;

export default async function InsightsAdminPage() {
  await requireRolePage("admin", "/admin/insights");
  const insights = await listInsightsAdmin();

  return (
    <>
      <AdminPageHeader
        title="Insights"
        description="Editorial analysis written by the TaxKatha desk. Members can like, save, share and discuss each piece."
        actions={
          <Link href="/admin/insights/new" className={buttonVariants()}>
            <Plus strokeWidth={1.75} /> New insight
          </Link>
        }
      />

      <AdminCard>
        {insights.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <PenLine strokeWidth={1.25} className="size-10 text-gold-700" aria-hidden />
            <h2 className="type-display-sm mt-5">No insights yet</h2>
            <p className="type-small mt-2 max-w-md text-muted-foreground">
              Write the first analysis piece — explain what a ruling means in practice and embed the rulings you discuss.
            </p>
            <Link href="/admin/insights/new" className={buttonVariants({ className: "mt-6" })}>
              Write an insight
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.map((insight) => (
                <TableRow key={insight.id}>
                  <TableCell className="max-w-md">
                    <Link href={`/admin/insights/${insight.id}`} className="font-semibold text-foreground hover:text-gold-text hover:underline">
                      <span className="line-clamp-2 whitespace-normal">{insight.title}</span>
                    </Link>
                    <span className="type-caption text-muted-foreground">
                      {insight.authorName ?? "TaxKatha"} · {insight.readingMinutes} min read
                      {insight.membersOnly ? " · members only" : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS[insight.status].variant}>{STATUS[insight.status].label}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {insight.publishedAt && insight.status !== "draft" ? formatDateTime(insight.publishedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(insight.viewCount ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(insight.likeCount ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(insight.commentCount ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminCard>
    </>
  );
}
