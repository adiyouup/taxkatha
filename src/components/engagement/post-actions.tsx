"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import { useEngagement } from "@/components/engagement/engagement-provider";
import { ShareSheet, type ShareTarget } from "@/components/engagement/share-sheet";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setLike, setSave } from "@/server/actions/engagement";

/**
 * Like · comment · save · share. Used compact on cards and larger on the
 * post page. Updates are optimistic and roll back if the server refuses.
 */
export function PostActions({
  target,
  counts,
  variant = "card",
  className,
}: {
  target: ShareTarget;
  counts: { likes: number; comments: number };
  variant?: "card" | "bar";
  className?: string;
}) {
  const engagement = useEngagement();
  const { track } = engagement;
  const [likeCount, setLikeCount] = useState(counts.likes);
  const [shareOpen, setShareOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => track(target.id), [track, target.id]);

  const liked = engagement.isLiked(target.id);
  const saved = engagement.isSaved(target.id);
  const bar = variant === "bar";

  // Only a KNOWN signed-out state prompts for sign-in. While the session is
  // still loading (signedIn === null) we go ahead optimistically and let the
  // server decide, so a member who taps quickly is never asked to sign in.
  function like() {
    if (engagement.signedIn === false) return engagement.promptSignIn("like this ruling");
    const next = !liked;
    engagement.markLiked(target.id, next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    startTransition(async () => {
      const result = await setLike(target.id, next);
      if (result.ok) return setLikeCount(result.data.count);
      engagement.markLiked(target.id, !next);
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
      if (result.code === "unauthenticated") engagement.promptSignIn("like this ruling");
      else toast.error(result.error);
    });
  }

  function save() {
    if (engagement.signedIn === false) return engagement.promptSignIn("save this ruling");
    const next = !saved;
    engagement.markSaved(target.id, next);
    startTransition(async () => {
      const result = await setSave(target.id, next);
      if (result.ok) {
        if (next) toast.success("Saved. Find it under Saved in your account menu.");
        return;
      }
      engagement.markSaved(target.id, !next);
      if (result.code === "unauthenticated") engagement.promptSignIn("save this ruling");
      else toast.error(result.error);
    });
  }

  const button = cn(
    "relative z-10 inline-flex items-center gap-1.5 rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    bar ? "h-10 border border-input bg-card px-3.5 text-sm font-semibold hover:border-gold-600 dark:border-white/25 dark:bg-white/5 dark:text-paper/85" : "h-8 px-1.5 text-[0.8125rem]",
  );
  const icon = bar ? "size-[1.125rem]" : "size-4";

  return (
    <div className={cn("flex items-center", bar ? "flex-wrap gap-2" : "gap-1", className)}>
      <button type="button" onClick={like} aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} className={cn(button, liked && "text-gold-700 dark:text-gold-400")}>
        <Heart
          strokeWidth={1.5}
          className={cn(icon, "transition-transform duration-300 ease-out-expo", liked && "scale-110 fill-gold-500 text-gold-600 dark:text-gold-400")}
          aria-hidden
        />
        <span className="tabular-nums">{formatCompact(likeCount)}</span>
      </button>

      <Link href={`${target.path}#discussion`} aria-label={`${counts.comments} comments`} className={button}>
        <MessageCircle strokeWidth={1.5} className={icon} aria-hidden />
        <span className="tabular-nums">{formatCompact(counts.comments)}</span>
      </Link>

      <button type="button" onClick={save} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save"} className={cn(button, saved && "text-gold-700 dark:text-gold-400")}>
        <Bookmark strokeWidth={1.5} className={cn(icon, saved && "fill-gold-500 text-gold-600 dark:text-gold-400")} aria-hidden />
        {bar ? <span>{saved ? "Saved" : "Save"}</span> : null}
      </button>

      <button type="button" onClick={() => setShareOpen(true)} aria-label="Share" className={button}>
        <Share2 strokeWidth={1.5} className={icon} aria-hidden />
        {bar ? <span>Share</span> : null}
      </button>

      {shareOpen ? <ShareSheet target={target} open={shareOpen} onOpenChange={setShareOpen} /> : null}
    </div>
  );
}
