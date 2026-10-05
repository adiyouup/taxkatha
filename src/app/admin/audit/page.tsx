import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";

import { AdminFilters, FilterSearch, FilterSelect } from "@/components/admin/admin-filters";
import { AdminPagination, EmptyState } from "@/components/admin/admin-ui";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { oneOf, pageParam, param } from "@/lib/admin-params";
import { formatDateTime } from "@/lib/format";
import { requireRolePage } from "@/server/auth/dal";
import { AUDIT_AREAS, AUDIT_PAGE_SIZE, listAudit, listAuditActors, type AuditArea } from "@/server/queries/admin-audit";

export const metadata: Metadata = { title: "Audit log" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const PATH = "/admin/audit";

/** Where an entry's subject can be opened in the admin, when it still exists. */
function entityHref(entityType: string, entityId: string | null, action: string): string | null {
  if (!entityId) return null;
  if (entityType === "post") return action.startsWith("insight.") ? `/admin/insights/${entityId}` : `/admin/case-laws/${entityId}`;
  if (entityType === "user" && action !== "user.delete") return `/admin/users/${entityId}`;
  if (entityType === "import_batch") return `/admin/import/${entityId}`;
  if (entityType === "topic") return "/admin/taxonomy";
  if (entityType === "court") return "/admin/taxonomy?tab=courts";
  if (entityType === "settings") return "/admin/settings";
  return null;
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireRolePage("admin", PATH);
  const query = await searchParams;
  const filters = {
    area: oneOf(query, "area", Object.keys(AUDIT_AREAS) as AuditArea[]),
    actor: param(query, "actor", 64),
    q: param(query, "q"),
  };
  const page = pageParam(query);
  const [{ rows, total }, actors] = await Promise.all([listAudit(filters, page), listAuditActors()]);

  return (
    <>
      <AdminPageHeader title="Audit log" description="Every change made in the admin: who did it, and when. Entries cannot be edited or removed." />
      <AdminCard flush>
        <div className="border-b px-5 py-4 sm:px-6">
          <AdminFilters action={PATH}>
            <FilterSearch defaultValue={filters.q} placeholder="Search the log" label="Search the audit log" />
            <FilterSelect
              name="area"
              label="Area"
              defaultValue={filters.area}
              options={[{ value: "", label: "All areas" }, ...(Object.entries(AUDIT_AREAS) as [AuditArea, string][]).map(([value, label]) => ({ value, label }))]}
            />
            <FilterSelect name="actor" label="Who" defaultValue={filters.actor} options={[{ value: "", label: "Everyone" }, ...actors.map((a) => ({ value: a.id, label: a.name }))]} />
          </AdminFilters>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={History} title="No entries">
            Changes made in the admin are recorded here.
          </EmptyState>
        ) : (
          <ol className="divide-y">
            {rows.map((row) => {
              const href = entityHref(row.entityType, row.entityId, row.action);
              return (
                <li key={row.id} className="grid gap-x-6 gap-y-1 px-5 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:px-6">
                  <p className="type-caption pt-0.5 text-muted-foreground tabular-nums">{formatDateTime(row.createdAt)}</p>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      {href ? (
                        <Link href={href} className="hover:text-gold-text hover:underline">
                          {row.summary}
                        </Link>
                      ) : (
                        row.summary
                      )}
                    </p>
                    <p className="type-caption mt-0.5 text-muted-foreground">
                      {/* Entries outlive the accounts that made them; the seed script runs without one. */}
                      {row.actorName ?? "No account (command line, or since deleted)"} ·{" "}
                      <code className="text-[0.6875rem]">{row.action}</code>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <AdminPagination path={PATH} params={filters} page={page} pageSize={AUDIT_PAGE_SIZE} total={total} />
      </AdminCard>
    </>
  );
}
