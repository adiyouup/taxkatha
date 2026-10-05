import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Share2, UserPlus, Users } from "lucide-react";

import { AdminTabs, StatTile } from "@/components/admin/admin-ui";
import { AdminCard, AdminPageHeader } from "@/components/admin/page-header";
import { TrendChart } from "@/components/admin/trend-chart";
import { oneOf } from "@/lib/admin-params";
import { formatNumber } from "@/lib/format";
import { PROFESSIONS } from "@/lib/professions";
import { requireRolePage } from "@/server/auth/dal";
import { getMarketingReport, MARKETING_PERIODS } from "@/server/queries/admin-marketing";

export const metadata: Metadata = { title: "Marketing" };

// Admin pages are per-request; they may block on the session (see admin/layout.tsx).
export const instant = false;

const CHANNEL = {
  native: "Phone share sheet",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  x: "X",
  telegram: "Telegram",
  email: "Email",
  copy_link: "Copied link",
  story_card: "Story card",
  square_card: "Square card",
} as Record<string, string>;

/** A horizontal bar list: label, value and a bar scaled to the largest value. */
function Bars({ rows, empty }: { rows: { key: string; label: React.ReactNode; value: number; note?: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="type-small text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatNumber(row.value)}
              {row.note ? <span className="ml-1.5 font-normal text-muted-foreground">{row.note}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-gold-500" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function MarketingPage({ searchParams }: PageProps<"/admin/marketing">) {
  await requireRolePage("admin", "/admin/marketing");
  const period = oneOf(await searchParams, "days", MARKETING_PERIODS) ?? "30";
  const days = Number(period);
  const report = await getMarketingReport(days);
  const shares = report.channels.reduce((sum, c) => sum + c.shares, 0);
  const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

  return (
    <>
      <AdminPageHeader
        title="Marketing"
        description="Where members come from and what they share. Sources come from utm_ tags and ref links on shared posts."
      />
      <AdminTabs
        label="Period"
        tabs={MARKETING_PERIODS.map((p) => ({ href: p === "30" ? "/admin/marketing" : `/admin/marketing?days=${p}`, label: `Last ${p} days`, active: p === period }))}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={`New members, ${days} days`} value={report.signups} delta={{ current: report.signups, previous: report.previousSignups }} icon={UserPlus} />
        <StatTile label="All members" value={report.members} hint={`${percent(report.onboarded, report.members)} finished setup`} icon={Users} />
        <StatTile label="Opted in to email" value={report.optedIn} hint={`${percent(report.optedIn, report.members)} of members`} icon={Mail} />
        <StatTile label={`Shares, ${days} days`} value={shares} icon={Share2} />
      </div>

      <AdminCard title="Sign-ups and shares" description="Per day (UTC)" className="mt-6">
        <TrendChart
          days={report.series.days}
          caption={`New members and shares per day over the last ${days} days`}
          series={[
            { label: "New members", values: report.series.signups, tone: "gold" },
            { label: "Shares", values: report.series.shares, tone: "navy" },
          ]}
        />
      </AdminCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminCard title="Where new members came from" description="utm_source of their first visit">
          <Bars
            empty="No sign-ups in this period."
            rows={report.sources.map((s) => ({ key: s.source, label: s.source, value: s.signups, note: `· ${percent(s.opted_in, s.signups)} opted in` }))}
          />
        </AdminCard>
        <AdminCard title="Campaigns" description="utm_campaign">
          <Bars
            empty="No tagged campaigns brought in members in this period."
            rows={report.campaigns.map((c) => ({ key: c.campaign, label: `${c.campaign}${c.source ? ` · ${c.source}` : ""}`, value: c.signups }))}
          />
        </AdminCard>
        <AdminCard title="Shares by channel">
          <Bars empty="Nothing was shared in this period." rows={report.channels.map((c) => ({ key: c.channel, label: CHANNEL[c.channel] ?? c.channel, value: c.shares }))} />
        </AdminCard>
        <AdminCard title="Most shared">
          <Bars
            empty="Nothing was shared in this period."
            rows={report.shared.map((p) => ({
              key: p.id,
              label: (
                <Link href={`/${p.type === "insight" ? "insights" : "case-laws"}/${p.slug}`} target="_blank" className="hover:text-gold-text hover:underline">
                  {p.title}
                </Link>
              ),
              value: p.shares,
            }))}
          />
        </AdminCard>
        <AdminCard title="Members who invite others" description="New members who arrived through their shared links">
          <Bars
            empty="No referred sign-ups in this period."
            rows={report.referrers.map((r) => ({
              key: r.id,
              label: (
                <Link href={`/admin/users/${r.id}`} className="hover:text-gold-text hover:underline">
                  {r.name}
                </Link>
              ),
              value: r.referred,
            }))}
          />
        </AdminCard>
        <AdminCard title="Landing pages" description="First page new members saw">
          <Bars empty="No landing pages recorded in this period." rows={report.landing.map((l) => ({ key: l.path, label: <code className="text-xs">{l.path}</code>, value: l.signups }))} />
        </AdminCard>
        <AdminCard title="Members by profession" description="All time" className="lg:col-span-2">
          <Bars
            empty="No members yet."
            rows={report.professions.map((p) => ({
              key: p.profession ?? "none",
              label: PROFESSIONS.find((x) => x.value === p.profession)?.label ?? "Not given",
              value: p.members,
              note: `· ${percent(p.members, report.members)}`,
            }))}
          />
        </AdminCard>
      </div>
    </>
  );
}
