import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus, Scale } from "lucide-react";

import { AdminFilters, FilterSearch, FilterSelect } from "@/components/admin/admin-filters";
import { AdminPagination, AdminTabs, EmptyState } from "@/components/admin/admin-ui";
import { CaseTable } from "@/components/admin/case-table";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { hrefWith, oneOf, pageParam, param, uuidParam } from "@/lib/admin-params";
import { COURT_TYPE_LABEL, type CourtType } from "@/lib/labels";
import { requireRolePage } from "@/server/auth/dal";
import {
  ADMIN_CASES_PAGE_SIZE,
  CASE_FLAGS,
  CASE_SORTS,
  CASE_STATUSES,
  countCasesByStatus,
  listAllTopicOptions,
  listCasesAdmin,
  type AdminCaseFilters,
} from "@/server/queries/admin-posts";

export const metadata: Metadata = { title: "Case laws" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const PATH = "/admin/case-laws";
const FORUMS = Object.keys(COURT_TYPE_LABEL) as CourtType[];

export default async function CaseLawsAdminPage({ searchParams }: PageProps<"/admin/case-laws">) {
  await requireRolePage("admin", PATH);
  const query = await searchParams;
  const filters: AdminCaseFilters = {
    q: param(query, "q"),
    status: oneOf(query, "status", CASE_STATUSES),
    forum: oneOf(query, "forum", FORUMS),
    topic: uuidParam(query, "topic"),
    flag: oneOf(query, "flag", CASE_FLAGS),
    batch: uuidParam(query, "batch"),
    sort: oneOf(query, "sort", CASE_SORTS),
  };
  const page = pageParam(query);
  const current = { ...filters };

  const [{ rows, total }, counts, topics] = await Promise.all([listCasesAdmin(filters, page), countCasesByStatus(), listAllTopicOptions()]);
  const filtered = Boolean(filters.q || filters.forum || filters.topic || filters.flag || filters.batch);

  return (
    <>
      <AdminPageHeader
        title="Case laws"
        description="Every ruling on TaxKatha. Edit a ruling to correct it, or select several to publish, unpublish or feature them together."
        actions={
          <>
            <a href={hrefWith(`${PATH}/export`, { ...current, status: filters.status })} download className={buttonVariants({ variant: "outline" })}>
              <Download strokeWidth={1.5} /> Export
            </a>
            <Link href={`${PATH}/new`} className={buttonVariants()}>
              <Plus strokeWidth={1.75} /> Add ruling
            </Link>
          </>
        }
      />

      <AdminTabs
        label="Status"
        tabs={[
          { href: hrefWith(PATH, current, { status: undefined, page: undefined }), label: "All", count: counts.all, active: !filters.status },
          ...CASE_STATUSES.map((status) => ({
            href: hrefWith(PATH, current, { status, page: undefined }),
            label: status === "published" ? "Published" : status === "draft" ? "Drafts" : "Archived",
            count: counts[status],
            active: filters.status === status,
          })),
        ]}
      />

      <AdminCard flush>
        <div className="border-b px-5 py-4 sm:px-6">
          <AdminFilters action={PATH}>
            {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
            {filters.batch ? <input type="hidden" name="batch" value={filters.batch} /> : null}
            <FilterSearch defaultValue={filters.q} placeholder="Name, case number or link" label="Search rulings" />
            <FilterSelect
              name="forum"
              label="Forum"
              defaultValue={filters.forum}
              options={[{ value: "", label: "All forums" }, ...FORUMS.map((f) => ({ value: f, label: COURT_TYPE_LABEL[f] }))]}
            />
            <FilterSelect
              name="topic"
              label="Topic"
              defaultValue={filters.topic}
              className="max-w-56"
              options={[{ value: "", label: "All topics" }, ...topics.map((t) => ({ value: t.id, label: t.reviewed ? t.name : `${t.name} (unreviewed)` }))]}
            />
            <FilterSelect
              name="flag"
              label="Show only"
              defaultValue={filters.flag}
              options={[
                { value: "", label: "Everything" },
                { value: "featured", label: "Featured" },
                { value: "edited", label: "Edited in admin" },
                { value: "unreviewed_topic", label: "Unreviewed topic" },
                { value: "no_topic", label: "No topic" },
                { value: "unknown_outcome", label: "Outcome not recognised" },
              ]}
            />
            <FilterSelect
              name="sort"
              label="Sort by"
              defaultValue={filters.sort}
              options={[
                { value: "", label: "Newest decision" },
                { value: "updated", label: "Recently changed" },
                { value: "views", label: "Most viewed" },
                { value: "comments", label: "Most discussed" },
              ]}
            />
          </AdminFilters>
          {filters.batch ? (
            <p className="type-caption mt-3 text-muted-foreground">
              Showing rulings from one import.{" "}
              <Link href={hrefWith(PATH, current, { batch: undefined })} className="font-semibold text-gold-text hover:underline">
                Show all
              </Link>
            </p>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Scale} title={filtered || filters.status ? "No rulings match" : "No rulings yet"}>
            {filtered || filters.status ? (
              <Link href={PATH} className="font-semibold text-gold-text hover:underline">
                Clear the filters
              </Link>
            ) : (
              <>
                <Link href="/admin/import" className="font-semibold text-gold-text hover:underline">
                  Import a workbook
                </Link>{" "}
                or add a ruling by hand.
              </>
            )}
          </EmptyState>
        ) : (
          <CaseTable rows={rows} />
        )}
        <AdminPagination path={PATH} params={current} page={page} pageSize={ADMIN_CASES_PAGE_SIZE} total={total} />
      </AdminCard>
    </>
  );
}
