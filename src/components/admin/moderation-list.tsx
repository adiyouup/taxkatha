"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { EyeOff, Flag, Loader2, MessageSquareText, RotateCcw, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dismissReports, moderateComment } from "@/server/actions/moderation";

export type ModerationItem = {
  id: string;
  rootId: string | null;
  body: string;
  status: "visible" | "hidden" | "deleted";
  createdAt: string;
  edited: boolean;
  replyCount: number;
  author: { id: string | null; name: string; email: string | null; staff: boolean; banned: boolean };
  post: { title: string; path: string };
  reports: { count: number; reasons: string[]; notes: string[] } | null;
};

const REASON = { spam: "Spam", abuse: "Abuse", misinformation: "Misinformation", off_topic: "Off topic", other: "Other" } as Record<string, string>;

function Item({ item, now, admin }: { item: ModerationItem; now: Date; admin: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  function act(action: "hide" | "unhide" | "delete" | "dismiss") {
    setBusy(action);
    startTransition(async () => {
      const result = action === "dismiss" ? await dismissReports(item.id) : await moderateComment({ commentId: item.id, action });
      setBusy(null);
      setConfirmDelete(false);
      if (!result.ok) return void toast.error(result.error);
      toast.success(
        action === "hide" ? "Comment hidden." : action === "unhide" ? "Comment restored." : action === "delete" ? "Comment deleted." : "Reports dismissed.",
      );
    });
  }

  const thread = `${item.post.path}/thread/${item.rootId ?? item.id}`;

  return (
    <li className={cn("px-5 py-5 sm:px-6", item.status !== "visible" && "bg-muted/35")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-semibold text-foreground">{item.author.name}</p>
        {item.author.staff ? <Badge variant="navy">TaxKatha</Badge> : null}
        {item.author.banned ? <Badge variant="destructive">Banned</Badge> : null}
        {item.status === "hidden" ? (
          <Badge variant="outline">
            <EyeOff /> Hidden
          </Badge>
        ) : null}
        {item.status === "deleted" ? <Badge variant="secondary">Deleted</Badge> : null}
        <span className="type-caption text-muted-foreground" title={formatDateTime(item.createdAt)}>
          · {formatRelative(item.createdAt, now)}
          {item.edited ? " · edited" : ""}
        </span>
      </div>
      <p className="type-caption mt-0.5 text-muted-foreground">
        on{" "}
        <Link href={item.post.path} target="_blank" className="font-medium text-foreground hover:text-gold-text hover:underline">
          {item.post.title}
        </Link>
        {item.rootId ? " · reply" : ""}
        {item.replyCount > 0 ? ` · ${pluralize(item.replyCount, "reply", "replies")}` : ""}
      </p>

      {item.status === "deleted" ? (
        <p className="type-small mt-3 text-muted-foreground italic">The text of this comment has been erased.</p>
      ) : (
        <p className="mt-3 line-clamp-6 text-[0.9375rem] leading-relaxed whitespace-pre-line text-foreground/90">{item.body}</p>
      )}

      {item.reports ? (
        <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-2.5">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-destructive">
            <Flag className="size-3.5" aria-hidden /> {pluralize(item.reports.count, "open report")}
            <span className="font-normal text-foreground/80">· {item.reports.reasons.map((r) => REASON[r] ?? r).join(", ")}</span>
          </p>
          {item.reports.notes.slice(0, 3).map((note, i) => (
            <p key={i} className="type-caption mt-1 text-foreground/80">
              “{note}”
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.status === "visible" ? (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act("hide")}>
            {busy === "hide" ? <Loader2 className="animate-spin" /> : <EyeOff />} Hide
          </Button>
        ) : null}
        {item.status === "hidden" ? (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act("unhide")}>
            {busy === "unhide" ? <Loader2 className="animate-spin" /> : <RotateCcw />} Restore
          </Button>
        ) : null}
        {item.reports ? (
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => act("dismiss")}>
            {busy === "dismiss" ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Keep and dismiss reports
          </Button>
        ) : null}
        {item.status !== "deleted" ? (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy !== null} onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Delete
          </Button>
        ) : null}
        <span className="ml-auto flex flex-wrap items-center gap-3">
          <Link href={thread} target="_blank" className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-gold-text hover:underline">
            <MessageSquareText className="size-3.5" aria-hidden /> Open thread
          </Link>
          {admin && item.author.id ? (
            <Link href={`/admin/users/${item.author.id}`} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-muted-foreground hover:text-foreground hover:underline">
              <UserRound className="size-3.5" aria-hidden /> Member
            </Link>
          ) : null}
        </span>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this comment?"
        description="Its text is erased for everyone, including its author. Replies stay in place under a “deleted” placeholder. To take it down but keep a record, hide it instead."
        confirmLabel="Delete comment"
        destructive
        pending={busy === "delete"}
        onConfirm={() => act("delete")}
      />
    </li>
  );
}

export function ModerationList({ items, admin, empty }: { items: ModerationItem[]; admin: boolean; empty: React.ReactNode }) {
  const [now] = useState(() => new Date());
  if (items.length === 0) return <>{empty}</>;
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <Item key={item.id} item={item} now={now} admin={admin} />
      ))}
    </ul>
  );
}
