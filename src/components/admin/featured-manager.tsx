"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";

import { PostPicker } from "@/components/admin/post-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { clearExpiredFeatures, featurePost, reorderFeatured, unfeaturePost, updateFeature } from "@/server/actions/featured";

export type FeaturedItem = {
  id: string;
  type: "case_law" | "insight";
  title: string;
  live: boolean;
  expired: boolean;
  /** YYYY-MM-DD (India time) or null. */
  until: string | null;
  note: string;
  meta: string;
};

/** How many featured posts the home page and the directory show. */
export const FEATURED_SLOTS = 3;

function Row({
  item,
  index,
  count,
  busy,
  onMove,
  onRemove,
}: {
  item: FeaturedItem;
  index: number;
  count: number;
  busy: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
}) {
  const [until, setUntil] = useState(item.until ?? "");
  const [note, setNote] = useState(item.note);
  const [saving, startSaving] = useTransition();
  const changed = until !== (item.until ?? "") || note !== item.note;
  const editHref = item.type === "insight" ? `/admin/insights/${item.id}` : `/admin/case-laws/${item.id}`;

  return (
    <li className={cn("grid gap-4 px-5 py-5 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:px-6", (!item.live || item.expired) && "bg-muted/40")}>
      <p className="type-numeral text-3xl leading-none text-gold-700" aria-label={`Position ${index + 1}`}>
        {String(index + 1).padStart(2, "0")}
      </p>
      <div className="min-w-0 space-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={item.type === "insight" ? "gold" : "secondary"}>{item.type === "insight" ? "Insight" : "Ruling"}</Badge>
            {!item.live ? <Badge variant="destructive">Not published — hidden from visitors</Badge> : null}
            {item.expired ? <Badge variant="outline">Ended {item.until ? formatDate(item.until) : ""}</Badge> : null}
          </div>
          <Link href={editHref} className="mt-2 block font-semibold leading-snug text-foreground hover:text-gold-text hover:underline">
            {item.title}
          </Link>
          {item.meta ? <p className="type-caption mt-1 text-muted-foreground">{item.meta}</p> : null}
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            startSaving(async () => {
              const result = await updateFeature({ postId: item.id, until: until || null, note });
              if (!result.ok) return void toast.error(result.error);
              toast.success("Saved.");
            });
          }}
        >
          <label className="min-w-0 flex-1 basis-56">
            <span className="type-caption mb-1 block text-muted-foreground">Editor’s note (shown on the card)</span>
            <Input value={note} maxLength={140} placeholder="Why this matters now" onChange={(event) => setNote(event.target.value)} className="h-9 text-sm" />
          </label>
          <label>
            <span className="type-caption mb-1 block text-muted-foreground">Feature until</span>
            <Input type="date" value={until} onChange={(event) => setUntil(event.target.value)} className="h-9 w-40 text-sm" />
          </label>
          <Button type="submit" size="sm" variant="navy" disabled={!changed || saving}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </form>
      </div>
      <div className="flex items-start gap-1 sm:flex-col sm:items-end">
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move “${item.title}” up`} disabled={busy || index === 0} onClick={() => onMove(index, index - 1)}>
          <ArrowUp />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Move “${item.title}” down`}
          disabled={busy || index === count - 1}
          onClick={() => onMove(index, index + 1)}
        >
          <ArrowDown />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Stop featuring “${item.title}”`} disabled={busy} onClick={() => onRemove(item.id)}>
          <X />
        </Button>
      </div>
    </li>
  );
}

export function FeaturedManager({ items }: { items: FeaturedItem[] }) {
  const [order, setOrder] = useState(items);
  const [source, setSource] = useState(items);
  const [busy, startBusy] = useTransition();
  // Fresh data from the server (after any save) replaces the local order.
  if (source !== items) {
    setSource(items);
    setOrder(items);
  }

  const expired = order.filter((item) => item.expired).length;

  function move(from: number, to: number) {
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    const previous = order;
    setOrder(next);
    startBusy(async () => {
      const result = await reorderFeatured(next.map((i) => i.id));
      if (!result.ok) {
        setOrder(previous);
        toast.error(result.error);
      }
    });
  }

  function remove(id: string) {
    startBusy(async () => {
      const result = await unfeaturePost(id);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Removed from featured.");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="overflow-hidden rounded-xl border bg-card shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-semibold">In order of appearance</h2>
            <p className="type-caption mt-1 text-muted-foreground">
              The first {FEATURED_SLOTS} appear on the home page and at the top of the directory.
            </p>
          </div>
          {expired > 0 ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                startBusy(async () => {
                  const result = await clearExpiredFeatures();
                  if (!result.ok) return void toast.error(result.error);
                  toast.success(`${pluralize(result.data.count, "ended post")} removed.`);
                })
              }
            >
              Remove {pluralize(expired, "ended post")}
            </Button>
          ) : null}
        </div>
        {order.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <Star strokeWidth={1.25} className="size-10 text-gold-700" aria-hidden />
            <h3 className="type-display-sm mt-5">Nothing is featured</h3>
            <p className="type-small mt-2 max-w-sm text-muted-foreground">
              The home page shows the latest Supreme Court rulings until you feature something. Add a post on the right.
            </p>
          </div>
        ) : (
          <ol className="divide-y">
            {order.map((item, index) => (
              <Fragment key={item.id}>
                {index === FEATURED_SLOTS ? (
                  <li aria-hidden className="type-caption bg-paper-2 px-6 py-2 text-center text-muted-foreground">
                    Below this line: marked as featured, but not shown on the home page
                  </li>
                ) : null}
                <Row item={item} index={index} count={order.length} busy={busy} onMove={move} onRemove={remove} />
              </Fragment>
            ))}
          </ol>
        )}
      </section>

      <aside className="h-fit rounded-xl border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Feature a post</h2>
        <p className="type-caption mt-1 mb-4 text-muted-foreground">Rulings and insights. New posts join the end of the list.</p>
        <PostPicker
          label="Find a post to feature"
          placeholder="Search by title, or paste a link"
          disabledIds={new Set(order.map((item) => item.id))}
          onPick={(post) =>
            startBusy(async () => {
              const result = await featurePost(post.id);
              if (!result.ok) return void toast.error(result.error);
              toast.success(`Featured: ${post.title}`);
            })
          }
        />
      </aside>
    </div>
  );
}
