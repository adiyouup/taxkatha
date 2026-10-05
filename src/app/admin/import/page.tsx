import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";

import { ImportDropzone } from "@/components/admin/import-dropzone";
import { BatchStatusBadge } from "@/components/admin/import-status";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import { requireRolePage } from "@/server/auth/dal";
import { listImportBatches } from "@/server/queries/admin-import";

export const metadata: Metadata = { title: "Import case laws" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const steps = [
  { n: "01", title: "Upload", text: "We read every row, clean the text and match courts, topics and outcomes." },
  { n: "02", title: "Review", text: "See what is new, what changed and anything that needs fixing — before it goes live." },
  { n: "03", title: "Publish", text: "Import in one click. Re-uploading the same file never creates duplicates." },
];

export default async function ImportPage() {
  await requireRolePage("admin", "/admin/import");
  const batches = await listImportBatches();

  return (
    <>
      <AdminPageHeader
        title="Import case laws"
        description="Upload the Excel workbook of case summaries. You will review the result before anything is published."
        actions={
          // A file download from a Route Handler, so a plain <a download>, not <Link>.
          <a href="/admin/import/template" download className={buttonVariants({ variant: "outline" })}>
            <Download strokeWidth={1.5} /> Download template
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <AdminCard title="Upload a workbook">
          <ImportDropzone />
        </AdminCard>

        <AdminCard title="How it works">
          <ol className="space-y-5">
            {steps.map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="type-numeral text-2xl leading-none text-gold-700">{step.n}</span>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">{step.title}</p>
                  <p className="type-caption mt-0.5 text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </AdminCard>
      </div>

      <AdminCard title="Import history" className="mt-6">
        {batches.length === 0 ? (
          <p className="type-small text-muted-foreground">No imports yet. Upload a workbook to get started.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Added</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Unchanged</TableHead>
                <TableHead className="text-right">Problems</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => {
                const done = batch.status === "committed";
                return (
                  <TableRow key={batch.id}>
                    <TableCell className="max-w-64">
                      <Link href={`/admin/import/${batch.id}`} className="font-semibold text-foreground hover:text-gold-text hover:underline">
                        <span className="block truncate">{batch.filename}</span>
                      </Link>
                      <span className="type-caption text-muted-foreground">
                        {formatNumber(batch.counts.total)} rows · {formatBytes(batch.fileSize)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(batch.createdAt)}
                      <span className="type-caption block text-muted-foreground">{batch.uploaderName ?? "Command line"}</span>
                    </TableCell>
                    <TableCell>
                      <BatchStatusBadge status={batch.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{done ? formatNumber(batch.counts.new) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{done ? formatNumber(batch.counts.changed) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(batch.counts.unchanged)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(batch.counts.invalid + batch.counts.duplicate)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </AdminCard>
    </>
  );
}
