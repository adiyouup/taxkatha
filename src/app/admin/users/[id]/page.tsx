import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailList } from "@/components/admin/admin-ui";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { UserActions } from "@/components/admin/user-actions";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber } from "@/lib/format";
import { truncate } from "@/lib/legal-text";
import { PROFESSIONS } from "@/lib/professions";
import { requireRolePage } from "@/server/auth/dal";
import { getUserAdmin } from "@/server/queries/admin-users";

export const metadata: Metadata = { title: "Member", robots: { index: false } };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const PROVIDER = { google: "Google", linkedin: "LinkedIn", microsoft: "Microsoft" } as Record<string, string>;

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const viewer = await requireRolePage("admin", `/admin/users/${id}`);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) notFound();
  const member = await getUserAdmin(id);
  if (!member) notFound();

  const profession = PROFESSIONS.find((p) => p.value === member.profession)?.label ?? "Not given";
  const a = member.acquisition;

  return (
    <>
      <AdminPageHeader
        title={
          <span className="flex items-center gap-4">
            <UserAvatar name={member.name} image={member.image} size="lg" />
            {member.name}
          </span>
        }
        crumbs={[{ label: "Members", href: "/admin/users" }, { label: member.name }]}
        actions={
          <>
            {member.role !== "user" ? <Badge variant="navy">{member.role === "admin" ? "Administrator" : "Moderator"}</Badge> : null}
            {member.banned ? <Badge variant="destructive">Banned</Badge> : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <AdminCard title="Profile">
            <DetailList
              items={[
                { label: "Email", value: `${member.email}${member.emailVerified ? "" : " (not verified)"}` },
                { label: "Signs in with", value: member.providers.map((p) => PROVIDER[p] ?? p).join(", ") || "—" },
                { label: "Profession", value: profession },
                { label: "Headline", value: member.headline ?? "—" },
                { label: "Joined", value: formatDateTime(member.createdAt) },
                { label: "Last active", value: member.lastActive ? formatDateTime(member.lastActive) : "—" },
                { label: "Marketing email", value: member.optIn ? "Opted in" : "Not opted in" },
              ]}
            />
          </AdminCard>

          <AdminCard
            title="Recent comments"
            action={
              <Link href={`/admin/community?tab=comments&author=${member.id}`} className="text-sm font-semibold text-gold-text hover:underline">
                All comments
              </Link>
            }
          >
            {member.recentComments.length === 0 ? (
              <p className="type-small text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="space-y-4">
                {member.recentComments.map((comment) => (
                  <li key={comment.id} className="border-b pb-4 last:border-0 last:pb-0">
                    <p className="type-caption text-muted-foreground">
                      on{" "}
                      <Link href={comment.path} target="_blank" className="font-medium text-foreground hover:text-gold-text hover:underline">
                        {comment.postTitle}
                      </Link>{" "}
                      · {formatDateTime(comment.createdAt)}
                      {comment.status !== "visible" ? ` · ${comment.status}` : ""}
                    </p>
                    <p className="mt-1.5 text-sm text-foreground/90">
                      {comment.status === "deleted" ? <em className="text-muted-foreground">Erased</em> : truncate(comment.body, 280)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>

        <div className="space-y-6">
          <AdminCard title="Access">
            <UserActions
              self={member.id === viewer.id}
              member={{
                id: member.id,
                name: member.name,
                email: member.email,
                role: member.role,
                banned: member.banned,
                banReason: member.banReason,
                banExpires: member.banExpires?.toISOString() ?? null,
                sessions: member.sessions,
              }}
            />
          </AdminCard>
          <AdminCard title="Activity">
            <DetailList
              items={[
                { label: "Comments", value: formatNumber(member.comments) },
                { label: "Likes", value: formatNumber(member.likes) },
                { label: "Saved posts", value: formatNumber(member.saves) },
                { label: "Reports filed", value: formatNumber(member.reportsFiled) },
                { label: "Reports against them", value: formatNumber(member.reportsAgainst) },
                { label: "Members they brought in", value: formatNumber(member.referred) },
              ]}
            />
          </AdminCard>
          <AdminCard title="How they found TaxKatha">
            <DetailList
              items={[
                { label: "Source", value: a.source ?? "Direct or unknown" },
                { label: "Medium", value: a.medium ?? "—" },
                { label: "Campaign", value: a.campaign ?? "—" },
                {
                  label: "Invited by",
                  value: a.refUser ? (
                    <Link href={`/admin/users/${a.refUser.id}`} className="font-semibold text-gold-text hover:underline">
                      {a.refUser.name}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                { label: "First page", value: a.landingPath ?? "—" },
              ]}
            />
          </AdminCard>
        </div>
      </div>
    </>
  );
}
