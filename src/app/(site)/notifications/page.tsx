import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bell, Heart, MessageCircle } from "lucide-react";

import { UserAvatar } from "@/components/auth/user-avatar";
import { MarkNotificationsRead } from "@/components/engagement/mark-read";
import { PageHeader, Section } from "@/components/layout/section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireViewer } from "@/server/auth/dal";
import { listNotifications } from "@/server/queries/member";

export const metadata: Metadata = { title: "Notifications", robots: { index: false, follow: false } };

const VERB = {
  reply: "replied to your comment on",
  official_reply: "from TaxKatha replied to your comment on",
  comment_like: "liked your comment on",
} as const;

async function NotificationList() {
  const viewer = await requireViewer("/notifications");
  const items = await listNotifications(viewer.id);
  const now = new Date();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <Bell strokeWidth={1.25} className="size-10 text-gold-700" aria-hidden />
        <h2 className="type-display-sm mt-5">You are all caught up</h2>
        <p className="type-small mt-2 max-w-md text-muted-foreground">Replies and likes on your comments will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <MarkNotificationsRead hasUnread={items.some((item) => item.unread)} />
      <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-soft">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className={cn("flex gap-4 px-5 py-4 transition-colors hover:bg-muted sm:px-6", item.unread && "bg-gold-50/70")}>
              <span className="relative mt-0.5 shrink-0">
                <UserAvatar name={item.actorName} image={item.actorImage} size="lg" />
                <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-navy-900 text-gold-400 ring-2 ring-card">
                  {item.type === "comment_like" ? <Heart className="size-2.5 fill-current" /> : <MessageCircle className="size-2.5" />}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-[0.9375rem] text-foreground">
                  <span className="font-semibold">{item.actorName}</span> {VERB[item.type]}{" "}
                  <span className="font-semibold">{item.postTitle}</span>
                </span>
                {item.excerpt && item.type !== "comment_like" ? (
                  <span className="type-small mt-1 line-clamp-2 block text-muted-foreground">“{item.excerpt}”</span>
                ) : null}
                <span className="type-caption mt-1 block text-muted-foreground">{formatRelative(item.createdAt, now)}</span>
              </span>
              {item.unread ? <span className="mt-2 size-2 shrink-0 rounded-full bg-gold-500" aria-label="Unread" /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function NotificationsPage() {
  return (
    <>
      <PageHeader eyebrow="Activity" title="Notifications" description="Replies and likes on your comments." />
      <Section className="py-10 md:py-14">
        <div className="container-wide max-w-3xl">
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <NotificationList />
          </Suspense>
        </div>
      </Section>
    </>
  );
}
