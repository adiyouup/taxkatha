import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";

import { ImportBatchActions } from "@/components/admin/import-batch-actions";
import { ImportCommitForm } from "@/components/admin/import-commit-form";
import { BatchStatusBadge, ROW_STATUS_LABEL, RowStatusBadge, type RowStatusKey } from "@/components/admin/import-status";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatDate, formatDateTime, formatNumber, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireRolePage } from "@/server/auth/dal";
import { outcomeLabel, type OutcomeSide } from "@/server/import/outcome";
import { canonicalTopicName } from "@/server/import/topics";
import { getImportBatch, IMPORT_ROWS_PAGE_SIZE, listImportRows } from "@/server/queries/admin-import";

export const metadata: Metadata = { title: "Import review" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = Object.keys(ROW_STATUS_LABEL) as RowStatusKey[];

const FIELD_LABEL: Record<string, string> = {
  caseName: "Case name",
  court: "Court",
  bench: "Bench",
  decisionDate: "Decision date",
  caseNumber: "Case no.",
  relevantSections: "Sections",
  background: "Background",
  decision: "Decision",
  outcome: "Outcome",
  summary: "Summary",
  domain: "Tax area",
  sections: "Sections",
  taxkathaId: "TaxKatha ID",
};

const OUTCOME_LABEL: Record<string, string> = {
  assessee: "In favour of assessee",
  assessee_remanded: "Assessee · remanded",
  revenue: "In favour of revenue",
  revenue_remanded: "Revenue · remanded",
  partly: "Partly",
  partly_remanded: "Partly · remanded",
  unknown: "See decision",
  unknown_remanded: "Remanded",
};

const DOMAIN_LABEL: Record<string, string> = {
  gst: "GST",
  income_tax: "Income-tax",
  customs: "Customs",
  excise: "Excise",
  service_tax: "Service tax",
  vat: "VAT",
  ibc: "IBC",
  other: "Other",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Tile({
  label,
  value,
  href,
  active,
  tone = "default",
}: {
  label: string;
  value: number;
  href: string;
  active: boolean;
  tone?: "default" | "gold" | "danger";
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-lg border bg-card px-4 py-3.5 transition-[border-color,box-shadow] hover:border-gold-600 hover:shadow-soft",
        active && "border-gold-600 shadow-soft ring-1 ring-gold-600/40",
      )}
    >
      <p
        className={cn(
          "type-numeral text-3xl leading-none",
          tone === "gold" && value > 0 ? "text-gold-700" : tone === "danger" && value > 0 ? "text-destructive" : "text-foreground",
        )}
      >
        {formatNumber(value)}
      </p>
      <p className="type-caption mt-1.5 text-muted-foreground">{label}</p>
    </Link>
  );
}

function Distribution({ data, labels }: { data: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, n]) => sum + n, 0) || 1;
  return (
    <ul className="space-y-2">
      {entries.map(([key, n]) => (
        <li key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="type-caption truncate text-foreground">{labels[key] ?? key}</span>
          <span className="type-caption tabular-nums text-muted-foreground">{formatNumber(n)}</span>
          <span className="col-span-2 h-1 overflow-hidden rounded-full bg-navy-900/8">
            <span className="block h-full rounded-full bg-gold-600" style={{ width: `${Math.max(2, (n / total) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ImportBatchPage({ params, searchParams }: PageProps<"/admin/import/[batchId]">) {
  const { batchId } = await params;
  await requireRolePage("admin", `/admin/import/${batchId}`);
  if (!UUID.test(batchId)) notFound();

  const query = await searchParams;
  const statusParam = first(query.status);
  const status = STATUSES.includes(statusParam as RowStatusKey) ? (statusParam as RowStatusKey) : undefined;
  const issuesOnly = first(query.issues) === "1";
  const page = Math.max(1, Number.parseInt(first(query.page) ?? "1", 10) || 1);

  const batch = await getImportBatch(batchId);
  if (!batch) notFound();
  const { rows, total } = await listImportRows(batchId, { status, issuesOnly, page });

  const { counts, report } = batch;
  const pages = Math.max(1, Math.ceil(total / IMPORT_ROWS_PAGE_SIZE));
  const href = (next: { status?: string; issues?: boolean; page?: number }) => {
    const p = new URLSearchParams();
    const s = "status" in next ? next.status : status;
    const i = "issues" in next ? next.issues : issuesOnly;
    if (s) p.set("status", s);
    if (i) p.set("issues", "1");
    if (next.page && next.page > 1) p.set("page", String(next.page));
    const qs = p.toString();
    return `/admin/import/${batchId}${qs ? `?${qs}` : ""}`;
  };

  const previewed = batch.status === "previewed";
  const committed = batch.status === "committed";

  return (
    <>
      <AdminPageHeader
        crumbs={[{ label: "Import", href: "/admin/import" }, { label: "Review" }]}
        title={batch.filename}
        description={
          <>
            {formatNumber(counts.total)} rows · {formatBytes(batch.fileSize)} · uploaded {formatDateTime(batch.createdAt)} by{" "}
            {batch.uploaderName ?? "command line"}
          </>
        }
        actions={<BatchStatusBadge status={batch.status} />}
      />

      {committed ? (
        <div className="mb-6 flex flex-wrap items-start gap-3 rounded-lg border border-gold-600/40 bg-gold-50 px-5 py-4">
          <CheckCircle2 strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-gold-700" />
          <p className="type-small min-w-0 flex-1 basis-80 text-foreground">
            <span className="font-semibold">
              Imported {batch.committedAt ? formatDateTime(batch.committedAt) : ""}:
            </span>{" "}
            {pluralize(counts.new, "case")} added, {formatNumber(counts.changed)} updated, {formatNumber(counts.unchanged)} unchanged
            {counts.skipped_manual_edit ? `, ${formatNumber(counts.skipped_manual_edit)} kept as edited in admin` : ""}.{" "}
            {batch.options?.publish ? "New cases were published." : "New cases were saved as drafts."}
          </p>
          <ImportBatchActions batchId={batch.id} added={counts.new} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label={committed ? "Added" : "New"} value={counts.new} href={href({ status: "new", page: 1 })} active={status === "new"} tone="gold" />
        <Tile label={committed ? "Updated" : "Changed"} value={counts.changed} href={href({ status: "changed", page: 1 })} active={status === "changed"} />
        <Tile label="Unchanged" value={counts.unchanged} href={href({ status: "unchanged", page: 1 })} active={status === "unchanged"} />
        <Tile label="Edited in admin" value={counts.skipped_manual_edit} href={href({ status: "skipped_manual_edit", page: 1 })} active={status === "skipped_manual_edit"} />
        <Tile label="Invalid" value={counts.invalid} href={href({ status: "invalid", page: 1 })} active={status === "invalid"} tone="danger" />
        <Tile label="Duplicate" value={counts.duplicate} href={href({ status: "duplicate", page: 1 })} active={status === "duplicate"} tone="danger" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {previewed ? (
          <AdminCard title="Ready to import" description="Review the rows below, then import.">
            <ImportCommitForm
              batchId={batch.id}
              toAdd={counts.new}
              toUpdate={counts.changed}
              editedInAdmin={counts.skipped_manual_edit}
            />
          </AdminCard>
        ) : (
          <AdminCard title="File">
            <dl className="type-small grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Sheet</dt>
              <dd>
                {report.sheet} (header on row {report.headerRow})
              </dd>
              <dt className="text-muted-foreground">Checksum</dt>
              <dd className="truncate font-mono text-xs">{batch.fileSha256.slice(0, 16)}…</dd>
              <dt className="text-muted-foreground">Uploaded</dt>
              <dd>{formatDateTime(batch.createdAt)}</dd>
            </dl>
          </AdminCard>
        )}

        <AdminCard title="What we cleaned up" description={`Sheet “${report.sheet}”, header found on row ${report.headerRow}.`}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="type-eyebrow text-[0.625rem] text-gold-text">Courts</p>
                <p className="type-small mt-1.5">
                  {formatNumber(report.courts.raw)} spellings merged into{" "}
                  <span className="font-semibold">{formatNumber(report.courts.canonical)} courts</span>.
                </p>
              </div>
              <div>
                <p className="type-eyebrow text-[0.625rem] text-gold-text">Topics</p>
                <p className="type-small mt-1.5">
                  {formatNumber(report.topics.labels)} labels matched to the topic list.
                  {report.topics.unknown.length > 0 ? (
                    <>
                      {" "}
                      <span className="font-semibold">{pluralize(report.topics.unknown.length, "new label")}</span> will be added
                      for review: {report.topics.unknown.map((t) => `“${t}”`).join(", ")}.
                    </>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="type-eyebrow text-[0.625rem] text-gold-text">Warnings</p>
                <p className="type-small mt-1.5">
                  {report.warnings > 0 ? (
                    <Link href={href({ status: undefined, issues: true, page: 1 })} scroll={false} className="font-semibold underline underline-offset-4 hover:text-gold-text">
                      {pluralize(report.warnings, "note")} to look at
                    </Link>
                  ) : (
                    "None."
                  )}
                </p>
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <p className="type-eyebrow mb-2.5 text-[0.625rem] text-gold-text">Outcomes</p>
                <Distribution data={report.outcomes} labels={OUTCOME_LABEL} />
              </div>
              <div>
                <p className="type-eyebrow mb-2.5 text-[0.625rem] text-gold-text">Tax areas</p>
                <Distribution data={report.domains} labels={DOMAIN_LABEL} />
              </div>
            </div>
          </div>
        </AdminCard>
      </div>

      <AdminCard
        className="mt-6"
        title="Rows"
        description={`${formatNumber(total)} ${status ? ROW_STATUS_LABEL[status].toLowerCase() : "in total"}${issuesOnly ? " with notes" : ""}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {status || issuesOnly ? (
              <Link href={href({ status: undefined, issues: false, page: 1 })} scroll={false} className="type-caption font-semibold text-gold-text hover:underline">
                Clear filters
              </Link>
            ) : null}
            <Link
              href={href({ issues: !issuesOnly, page: 1 })}
              scroll={false}
              className={cn(
                "type-caption rounded-md border px-2.5 py-1.5 font-semibold transition-colors",
                issuesOnly ? "border-gold-600 bg-gold-50 text-gold-800" : "text-muted-foreground hover:border-gold-600 hover:text-foreground",
              )}
            >
              Only rows with notes
            </Link>
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="type-small text-muted-foreground">No rows match this filter.</p>
        ) : (
          <ul className="-my-4 divide-y">
            {rows.map((row) => {
              const errors = row.issues.filter((i) => i.level === "error");
              const warnings = row.issues.filter((i) => i.level === "warning");
              const mappedTopic = row.topicKey ? canonicalTopicName(row.topicKey) : null;
              const topic = mappedTopic ?? (row.topicLabel ? `${row.topicLabel} · new topic` : null);
              return (
                <li key={row.rowNumber} className="grid gap-x-5 gap-y-2 py-4 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]">
                  <p className="type-caption tabular-nums text-muted-foreground sm:pt-0.5">Row {row.rowNumber}</p>
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-semibold text-foreground">
                      {row.caseName ?? row.rawName ?? "Untitled row"}
                    </p>
                    {row.courtName ? (
                      <p className="type-caption mt-0.5 text-muted-foreground">
                        {row.courtName}
                        {row.decisionDate ? ` · ${formatDate(row.decisionDate)}` : ""}
                        {row.outcomeSide ? ` · ${outcomeLabel(row.outcomeSide as OutcomeSide, Boolean(row.remanded))}` : ""}
                        {row.domainLabel ? ` · ${row.domainLabel}` : ""}
                      </p>
                    ) : null}
                    {row.summary ? <p className="type-caption mt-2 line-clamp-2 text-foreground/80">{row.summary}</p> : null}
                    {topic || (row.sectionRefs && row.sectionRefs.length > 0) ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {topic ? <Badge variant="gold">{topic}</Badge> : null}
                        {(row.sectionRefs ?? []).slice(0, 6).map((ref) => (
                          <Badge key={ref} variant="outline">
                            {ref}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {row.changedFields.length > 0 ? (
                      <p className="type-caption mt-2.5 text-foreground">
                        <span className="font-semibold">Changes:</span>{" "}
                        {row.changedFields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}
                      </p>
                    ) : null}
                    {errors.map((issue, i) => (
                      <p key={`e${i}`} className="type-caption mt-2 flex items-start gap-1.5 text-destructive">
                        <XCircle strokeWidth={1.75} className="mt-px size-3.5 shrink-0" />
                        <span>
                          {issue.field ? <span className="font-semibold">{FIELD_LABEL[issue.field] ?? issue.field}: </span> : null}
                          {issue.message}
                        </span>
                      </p>
                    ))}
                    {warnings.map((issue, i) => (
                      <p key={`w${i}`} className="type-caption mt-2 flex items-start gap-1.5 text-gold-800">
                        <AlertTriangle strokeWidth={1.75} className="mt-px size-3.5 shrink-0" />
                        <span>
                          {issue.field ? <span className="font-semibold">{FIELD_LABEL[issue.field] ?? issue.field}: </span> : null}
                          {issue.message}
                        </span>
                      </p>
                    ))}
                  </div>
                  <div className="sm:justify-self-end">
                    <RowStatusBadge status={row.status} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-8 flex items-center justify-between border-t pt-4">
            <p className="type-caption text-muted-foreground">
              Page {page} of {formatNumber(pages)}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={href({ page: page - 1 })} scroll={false} className="type-caption flex items-center gap-1 rounded-md border px-3 py-1.5 font-semibold hover:border-gold-600">
                  <ChevronLeft className="size-3.5" /> Previous
                </Link>
              ) : null}
              {page < pages ? (
                <Link href={href({ page: page + 1 })} scroll={false} className="type-caption flex items-center gap-1 rounded-md border px-3 py-1.5 font-semibold hover:border-gold-600">
                  Next <ChevronRight className="size-3.5" />
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </AdminCard>
    </>
  );
}
