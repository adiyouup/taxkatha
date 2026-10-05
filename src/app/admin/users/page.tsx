import type { Metadata } from "next";
import Link from "next/link";
import { Download, Users } from "lucide-react";

import { AdminFilters, FilterSearch } from "@/components/admin/admin-filters";
import { AdminPagination, AdminTabs, EmptyState } from "@/components/admin/admin-ui";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { hrefWith, oneOf, pageParam, param } from "@/lib/admin-params";
import { formatDate, formatNumber } from "@/lib/format";
import { professionShort } from "@/lib/professions";
import { requireRolePage } from "@/server/auth/dal";
import { countUsers, listUsersAdmin, USER_VIEWS, USERS_PAGE_SIZE } from "@/server/queries/admin-users";

export const metadata: Metadata = { title: "Members" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const PATH = "/admin/users";
const PROVIDER = { google: "Google", linkedin: "LinkedIn", microsoft: "Microsoft" } as Record<string, string>;

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireRolePage("admin", PATH);
  const query = await searchParams;
  const filters = { q: param(query, "q"), view: oneOf(query, "view", USER_VIEWS) };
  const page = pageParam(query);
  const [{ rows, total }, counts] = await Promise.all([listUsersAdmin(filters, page), countUsers()]);

  const tab = (view: (typeof USER_VIEWS)[number] | undefined, label: string, count: number) => ({
    href: hrefWith(PATH, { q: filters.q, view }),
    label,
    count,
    active: filters.view === view,
  });

  return (
    <>
      <AdminPageHeader
        title="Members"
        description="Everyone who has signed in. Open a member to change their role, ban them or delete their account."
        actions={
          <a href={`${PATH}/export`} download className={buttonVariants({ variant: "outline" })}>
            <Download strokeWidth={1.5} /> Export opted-in ({formatNumber(counts.opted_in)})
          </a>
        }
      />
      <AdminTabs
        label="Members"
        tabs={[
          tab(undefined, "All", counts.all),
          tab("new", "Joined in 30 days", counts.new),
          tab("staff", "Staff", counts.staff),
          tab("opted_in", "Opted in to email", counts.opted_in),
          tab("banned", "Banned", counts.banned),
        ]}
      />
      <AdminCard flush>
        <div className="border-b px-5 py-4 sm:px-6">
          <AdminFilters action={PATH}>
            {filters.view ? <input type="hidden" name="view" value={filters.view} /> : null}
            <FilterSearch defaultValue={filters.q} placeholder="Name or email" label="Search members" />
          </AdminFilters>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No members match">
            {filters.q || filters.view ? (
              <Link href={PATH} className="font-semibold text-gold-text hover:underline">
                Show everyone
              </Link>
            ) : (
              "Members appear here after their first sign-in."
            )}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="type-caption px-5 py-3 font-semibold text-muted-foreground sm:px-6">
                    Member
                  </th>
                  <th scope="col" className="type-caption py-3 pr-4 font-semibold text-muted-foreground">
                    Role
                  </th>
                  <th scope="col" className="type-caption py-3 pr-4 font-semibold text-muted-foreground">
                    Profession
                  </th>
                  <th scope="col" className="type-caption py-3 pr-4 font-semibold text-muted-foreground">
                    Joined
                  </th>
                  <th scope="col" className="type-caption py-3 pr-4 font-semibold text-muted-foreground">
                    Last active
                  </th>
                  <th scope="col" className="type-caption py-3 pr-5 text-right font-semibold text-muted-foreground sm:pr-6">
                    Comments
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-5 py-3 sm:px-6">
                      <Link href={`${PATH}/${row.id}`} className="group flex items-center gap-3">
                        <UserAvatar name={row.name} image={row.image} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-foreground group-hover:text-gold-text group-hover:underline">{row.name}</span>
                          <span className="type-caption block truncate text-muted-foreground">
                            {row.email}
                            {row.providers.length > 0 ? ` · ${row.providers.map((p) => PROVIDER[p] ?? p).join(", ")}` : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1.5">
                        {row.role !== "user" ? (
                          <Badge variant="navy">{row.role === "admin" ? "Admin" : "Moderator"}</Badge>
                        ) : (
                          <span className="text-muted-foreground">Member</span>
                        )}
                        {row.banned ? <Badge variant="destructive">Banned</Badge> : null}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {professionShort(row.profession) ?? <span className="text-muted-foreground">{row.onboarded ? "—" : "Not set up"}</span>}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {row.lastActive ? formatDate(row.lastActive) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 pr-5 text-right tabular-nums sm:pr-6">{formatNumber(row.comments)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminPagination path={PATH} params={filters} page={page} pageSize={USERS_PAGE_SIZE} total={total} />
      </AdminCard>
    </>
  );
}
