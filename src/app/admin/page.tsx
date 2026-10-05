import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenText, Eye, FileSpreadsheet, Flag, Heart, MessageSquare, PenLine, Scale, Share2, Star, Users } from "lucide-react";

import { StatTile } from "@/components/admin/admin-ui";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { TrendChart } from "@/components/admin/trend-chart";
import { BatchStatusBadge } from "@/components/admin/import-status";
import { buttonVariants } from "@/components/ui/button";
import { formatCompact, formatDateTime, formatNumber, pluralize } from "@/lib/format";
import { truncate } from "@/lib/legal-text";
import { hasRole, requireRolePage } from "@/server/auth/dal";
import { getDashboard } from "@/server/queries/admin-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

export default async function AdminHome() {
  const viewer = await requireRolePage("moderator", "/admin");
  const admin = hasRole(viewer, "admin");
  const data = await getDashboard();
  const { kpis } = data;

  const attention = [
    kpis.openReports > 0 ? { href: "/admin/community", label: `${formatNumber(kpis.openReports)} reported comment${kpis.openReports === 1 ? "" : "s"} to review`, icon: Flag } : null,
    admin && kpis.unreviewedTopics > 0
      ? { href: "/admin/taxonomy", label: `${formatNumber(kpis.unreviewedTopics)} new topic${kpis.unreviewedTopics === 1 ? "" : "s"} from imports to review`, icon: BookOpenText }
      : null,
    admin && kpis.expiredFeatures > 0
      ? { href: "/admin/featured", label: `${formatNumber(kpis.expiredFeatures)} featured post${kpis.expiredFeatures === 1 ? " has" : "s have"} ended`, icon: Star }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <>
      <AdminPageHeader
        title={`Welcome back, ${viewer.name.split(" ")[0]}`}
        description="How TaxKatha is doing this week, and what needs your attention."
        actions={
          admin ? (
            <>
              <Link href="/admin/import" className={buttonVariants({ variant: "outline" })}>
                <FileSpreadsheet strokeWidth={1.5} /> Import rulings
              </Link>
              <Link href="/admin/insights/new" className={buttonVariants()}>
                <PenLine strokeWidth={1.5} /> Write an insight
              </Link>
            </>
          ) : null
        }
      />

      {attention.length > 0 ? (
        <ul className="mb-6 space-y-2">
          {attention.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex items-center gap-3 rounded-lg border border-gold-600/40 bg-gold-50/70 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-gold-600"
              >
                <Icon strokeWidth={1.5} className="size-4.5 text-gold-700" aria-hidden />
                {label}
                <ArrowRight className="ml-auto size-4 text-gold-700 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Views this week" value={kpis.views7.current} delta={kpis.views7} hint="vs last week" icon={Eye} />
        <StatTile label="New members this week" value={kpis.members7.current} delta={kpis.members7} hint={`${formatNumber(kpis.members)} in all`} icon={Users} href={admin ? "/admin/users?view=new" : undefined} />
        <StatTile label="Comments this week" value={kpis.comments7.current} delta={kpis.comments7} hint="vs last week" icon={MessageSquare} href="/admin/community?tab=comments" />
        <StatTile label="Likes this week" value={kpis.likes7.current} delta={kpis.likes7} hint="vs last week" icon={Heart} />
        <StatTile label="Shares this week" value={kpis.shares7.current} delta={kpis.shares7} hint="vs last week" icon={Share2} href={admin ? "/admin/marketing?days=7" : undefined} />
        <StatTile
          label="Published rulings"
          value={kpis.cases}
          hint={`${pluralize(kpis.insights, "insight")}${kpis.casesHidden ? ` · ${pluralize(kpis.casesHidden, "ruling")} hidden` : ""}`}
          icon={Scale}
          href={admin ? "/admin/case-laws" : undefined}
        />
      </div>

      <AdminCard title="Last 30 days" description="Per day (UTC)" className="mt-6">
        <TrendChart
          days={data.series.days}
          caption="Views, comments and new members per day over the last 30 days"
          series={[
            { label: "Views", values: data.series.views, tone: "gold" },
            { label: "Comments", values: data.series.comments, tone: "navy" },
            { label: "New members", values: data.series.members, tone: "navy" },
          ]}
        />
      </AdminCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminCard title="Most engaging this week" description="Views, likes and comments in the last 7 days">
          {data.topPosts.length === 0 ? (
            <p className="type-small text-muted-foreground">No engagement recorded this week yet.</p>
          ) : (
            <ol className="space-y-3.5">
              {data.topPosts.map((post, index) => (
                <li key={post.id} className="flex items-start gap-3.5">
                  <span className="type-numeral w-6 shrink-0 text-xl leading-6 text-gold-700">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${post.type === "insight" ? "insights" : "case-laws"}/${post.slug}`}
                      target="_blank"
                      className="line-clamp-2 text-sm font-semibold text-foreground hover:text-gold-text hover:underline"
                    >
                      {post.title}
                    </Link>
                    <p className="type-caption mt-0.5 text-muted-foreground">
                      {formatCompact(post.views)} views · {formatCompact(post.likes)} likes · {formatCompact(post.comments)} comments
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </AdminCard>

        <AdminCard
          title="Latest comments"
          action={
            <Link href="/admin/community?tab=comments" className="text-sm font-semibold text-gold-text hover:underline">
              Moderate
            </Link>
          }
        >
          {data.recentComments.length === 0 ? (
            <p className="type-small text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-4">
              {data.recentComments.map((comment) => (
                <li key={comment.id} className="border-b pb-4 last:border-0 last:pb-0">
                  <p className="type-caption text-muted-foreground">
                    <span className="font-semibold text-foreground">{comment.author}</span> on{" "}
                    <Link href={comment.path} target="_blank" className="hover:text-foreground hover:underline">
                      {truncate(comment.postTitle, 60)}
                    </Link>{" "}
                    · {formatDateTime(comment.createdAt)}
                    {comment.status === "hidden" ? " · hidden" : ""}
                  </p>
                  <p className="mt-1 text-sm text-foreground/90">{truncate(comment.body, 160)}</p>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        {admin ? (
          <AdminCard
            title="Last import"
            action={
              <Link href="/admin/import" className="text-sm font-semibold text-gold-text hover:underline">
                All imports
              </Link>
            }
          >
            {data.lastImport ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/import/${data.lastImport.id}`} className="font-semibold text-foreground hover:text-gold-text hover:underline">
                    {data.lastImport.filename}
                  </Link>
                  <p className="type-caption mt-0.5 text-muted-foreground">
                    {formatDateTime(data.lastImport.createdAt)} · {formatNumber(data.lastImport.counts.new)} new · {formatNumber(data.lastImport.counts.changed)} changed
                  </p>
                </div>
                <BatchStatusBadge status={data.lastImport.status as "previewed" | "committing" | "committed" | "failed" | "discarded"} />
              </div>
            ) : (
              <p className="type-small text-muted-foreground">No workbook has been imported yet.</p>
            )}
          </AdminCard>
        ) : null}

        {admin ? (
          <AdminCard
            title="Insights"
            action={
              <Link href="/admin/insights" className="text-sm font-semibold text-gold-text hover:underline">
                All insights
              </Link>
            }
          >
            <p className="type-small text-muted-foreground">
              {formatNumber(kpis.insights)} published · {formatNumber(kpis.insightsPending)} in draft or scheduled
            </p>
            {data.scheduled.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {data.scheduled.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-4 text-sm">
                    <Link href={`/admin/insights/${item.id}`} className="min-w-0 truncate font-semibold hover:text-gold-text hover:underline">
                      {item.title}
                    </Link>
                    <span className="type-caption shrink-0 text-muted-foreground">{formatDateTime(item.at)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </AdminCard>
        ) : null}
      </div>
    </>
  );
}
