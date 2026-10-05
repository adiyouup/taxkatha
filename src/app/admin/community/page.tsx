import type { Metadata } from "next";
import { MessagesSquare, ShieldCheck } from "lucide-react";

import { AdminFilters, FilterSearch, FilterSelect } from "@/components/admin/admin-filters";
import { AdminPagination, AdminTabs, EmptyState } from "@/components/admin/admin-ui";
import { ModerationList, type ModerationItem } from "@/components/admin/moderation-list";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { hrefWith, oneOf, pageParam, param, uuidParam } from "@/lib/admin-params";
import { hasRole, requireRolePage } from "@/server/auth/dal";
import {
  COMMENT_STATUSES,
  COMMENTS_ADMIN_PAGE_SIZE,
  communityCounts,
  listCommentsAdmin,
  listReportedComments,
  type ModerationComment,
} from "@/server/queries/admin-community";

export const metadata: Metadata = { title: "Moderation" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const PATH = "/admin/community";

function toItem(comment: ModerationComment, admin: boolean): ModerationItem {
  return {
    id: comment.id,
    rootId: comment.rootId,
    body: comment.body,
    status: comment.status,
    createdAt: comment.createdAt.toISOString(),
    edited: comment.editedAt !== null,
    replyCount: comment.replyCount,
    // Moderators see who wrote a comment; only administrators see email addresses.
    author: { id: comment.author.id, name: comment.author.name, email: admin ? comment.author.email : null, staff: comment.author.role !== "user", banned: comment.author.banned },
    post: { title: comment.post.title, path: `/${comment.post.type === "insight" ? "insights" : "case-laws"}/${comment.post.slug}` },
    reports: comment.reports ? { count: comment.reports.count, reasons: comment.reports.reasons, notes: comment.reports.notes } : null,
  };
}

export default async function CommunityPage({ searchParams }: PageProps<"/admin/community">) {
  const viewer = await requireRolePage("moderator", PATH);
  const admin = hasRole(viewer, "admin");
  const query = await searchParams;
  const tab = oneOf(query, "tab", ["reports", "comments"] as const) ?? "reports";
  const filters = { status: oneOf(query, "status", COMMENT_STATUSES), q: param(query, "q"), author: uuidParam(query, "author") };
  const page = pageParam(query);

  const [counts, reported, feed] = await Promise.all([
    communityCounts(),
    tab === "reports" ? listReportedComments() : Promise.resolve([]),
    tab === "comments" ? listCommentsAdmin(filters, page) : Promise.resolve({ items: [], total: 0 }),
  ]);
  const current = { tab, ...filters };

  return (
    <>
      <AdminPageHeader
        title="Moderation"
        description="Review what members report and keep the discussion professional. Hidden comments stay visible to their author and to staff; deleted ones are erased."
      />
      <AdminTabs
        label="Moderation"
        tabs={[
          { href: PATH, label: "Reports", count: counts.openReports, active: tab === "reports" },
          { href: `${PATH}?tab=comments`, label: "All comments", count: counts.comments, active: tab === "comments" && !filters.status },
          { href: `${PATH}?tab=comments&status=hidden`, label: "Hidden", count: counts.hidden, active: tab === "comments" && filters.status === "hidden" },
        ]}
      />

      {tab === "reports" ? (
        <AdminCard flush>
          <ModerationList
            items={reported.map((c) => toItem(c, admin))}
            admin={admin}
            empty={
              <EmptyState icon={ShieldCheck} title="Nothing to review">
                No open reports. Members can report a comment from its menu; reports appear here.
              </EmptyState>
            }
          />
        </AdminCard>
      ) : (
        <AdminCard flush>
          <div className="border-b px-5 py-4 sm:px-6">
            <AdminFilters action={PATH}>
              <input type="hidden" name="tab" value="comments" />
              {filters.author ? <input type="hidden" name="author" value={filters.author} /> : null}
              <FilterSearch defaultValue={filters.q} placeholder="Words in the comment, member or post" label="Search comments" />
              <FilterSelect
                name="status"
                label="Status"
                defaultValue={filters.status}
                options={[
                  { value: "", label: "Any status" },
                  { value: "visible", label: "Visible" },
                  { value: "hidden", label: "Hidden" },
                  { value: "deleted", label: "Deleted" },
                ]}
              />
            </AdminFilters>
          </div>
          <ModerationList
            items={feed.items.map((c) => toItem(c, admin))}
            admin={admin}
            empty={<EmptyState icon={MessagesSquare} title="No comments match">Try a different search or status.</EmptyState>}
          />
          <AdminPagination path={PATH} params={current} page={page} pageSize={COMMENTS_ADMIN_PAGE_SIZE} total={feed.total} />
        </AdminCard>
      )}
      {tab === "comments" && filters.author ? (
        <p className="type-caption mt-3 text-muted-foreground">
          Showing one member’s comments.{" "}
          <a href={hrefWith(PATH, current, { author: undefined })} className="font-semibold text-gold-text hover:underline">
            Show everyone’s
          </a>
        </p>
      ) : null}
    </>
  );
}
