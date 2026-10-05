"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CornerDownRight, Flag, Heart, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/auth/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createComment, deleteComment, editComment, reportComment, setCommentLike } from "@/server/actions/comments";
import type { CommentDTO, CommentSort } from "@/server/comments";

const MAX = 2000;

type Me = { id: string; name: string; image: string | null };

/* --------------------------------- helpers -------------------------------- */

const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

/** Comments are plain text; URLs become safe links, everything else is escaped by React. */
function Body({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <p className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap text-foreground">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-gold-text underline underline-offset-2">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

function Composer({
  me,
  placeholder,
  submitLabel,
  initialValue = "",
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  me: Me;
  placeholder: string;
  submitLabel: string;
  initialValue?: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const trimmed = value.trim();
  const over = value.length > MAX;

  function submit() {
    if (!trimmed || over || pending) return;
    startTransition(async () => {
      if (await onSubmit(trimmed)) setValue("");
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex gap-3"
    >
      <UserAvatar name={me.name} image={me.image} className="mt-1" />
      <div className="min-w-0 flex-1">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
            if (event.key === "Escape" && onCancel) onCancel();
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          rows={2}
          maxLength={MAX + 200}
          className="min-h-20"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className={cn("type-caption", over ? "text-destructive" : "text-muted-foreground")}>
            {value.length > MAX - 200 ? (
              `${value.length} / ${MAX}`
            ) : (
              <>
                Be courteous.<span className="hidden sm:inline"> Press ⌘ or Ctrl + Enter to post.</span>
              </>
            )}
          </p>
          <div className="flex shrink-0 gap-2">
            {onCancel ? (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" variant="navy" size="sm" disabled={!trimmed || over || pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam or promotion" },
  { value: "abuse", label: "Abusive or disrespectful" },
  { value: "misinformation", label: "Misleading on the law" },
  { value: "off_topic", label: "Off topic" },
  { value: "other", label: "Something else" },
];

function ReportDialog({ commentId, onClose }: { commentId: string | null; onClose: () => void }) {
  const [reason, setReason] = useState("spam");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!commentId) return;
    startTransition(async () => {
      const result = await reportComment({ commentId, reason, note });
      if (result.ok) {
        toast.success("Thank you. A moderator will review this comment.");
        setNote("");
        onClose();
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog open={commentId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this comment</DialogTitle>
          <DialogDescription className="text-muted-foreground">Reports are confidential. Tell us what is wrong.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Reason</legend>
          {REPORT_REASONS.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-md border border-input px-3.5 py-2.5 text-sm has-checked:border-gold-600 has-checked:bg-gold-50">
              <input type="radio" name="reason" value={option.value} checked={reason === option.value} onChange={() => setReason(option.value)} className="accent-(--color-gold-700)" />
              {option.label}
            </label>
          ))}
        </fieldset>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Add a note for the moderators (optional)" aria-label="Note" className="min-h-16" />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="navy" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- comment -------------------------------- */

function CommentItem({
  comment,
  me,
  now,
  onReply,
  onChanged,
  onRemoved,
  onReport,
}: {
  comment: CommentDTO;
  me: Me;
  now: Date;
  onReply?: () => void;
  onChanged: (next: CommentDTO) => void;
  onRemoved: (id: string) => void;
  onReport: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const gone = comment.state !== "visible";

  function like() {
    const next = !comment.liked;
    onChanged({ ...comment, liked: next, likeCount: Math.max(0, comment.likeCount + (next ? 1 : -1)) });
    startTransition(async () => {
      const result = await setCommentLike(comment.id, next);
      if (result.ok) onChanged({ ...comment, liked: result.data.liked, likeCount: result.data.count });
      else {
        onChanged(comment);
        toast.error(result.error);
      }
    });
  }

  function remove() {
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteComment(comment.id);
      if (result.ok) onRemoved(comment.id);
      else toast.error(result.error);
    });
  }

  return (
    <article id={`comment-${comment.id}`} className="flex scroll-mt-28 gap-3">
      <UserAvatar name={gone ? "?" : comment.author.name} image={gone ? null : comment.author.image} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-foreground">{comment.state === "deleted" ? "Deleted" : comment.author.name}</span>
          {!gone && comment.author.badge ? (
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-xs px-1.5 text-[0.625rem] font-semibold tracking-[0.04em]",
                comment.author.staff ? "bg-navy-900 text-gold-400" : "border border-border text-muted-foreground",
              )}
            >
              {comment.author.badge}
            </span>
          ) : null}
          <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)} suppressHydrationWarning className="type-caption text-muted-foreground">
            {formatRelative(comment.createdAt, now)}
          </time>
          {comment.edited && !gone ? <span className="type-caption text-muted-foreground">· edited</span> : null}
        </header>

        {editing ? (
          <div className="mt-2">
            <Composer
              me={me}
              placeholder="Edit your comment"
              submitLabel="Save"
              initialValue={comment.body}
              autoFocus
              onCancel={() => setEditing(false)}
              onSubmit={async (body) => {
                const result = await editComment({ commentId: comment.id, body });
                if (!result.ok) {
                  toast.error(result.error);
                  return false;
                }
                onChanged({ ...result.data, replies: comment.replies });
                setEditing(false);
                return true;
              }}
            />
          </div>
        ) : (
          <div className="mt-1">
            {comment.state === "deleted" ? (
              <p className="text-sm text-muted-foreground italic">This comment was deleted.</p>
            ) : comment.state === "hidden" ? (
              <>
                <p className="text-sm text-muted-foreground italic">This comment was hidden by a moderator.</p>
                {comment.body ? <div className="mt-1.5 rounded-md border border-dashed p-2.5 opacity-70"><Body text={comment.body} /></div> : null}
              </>
            ) : (
              <>
                {comment.replyTo && comment.rootId ? (
                  <p className="type-caption mb-0.5 flex items-center gap-1 text-muted-foreground">
                    <CornerDownRight className="size-3" aria-hidden /> {comment.replyTo}
                  </p>
                ) : null}
                <Body text={comment.body} />
              </>
            )}
          </div>
        )}

        {!gone && !editing ? (
          <footer className="mt-1.5 -ml-2 flex items-center gap-1">
            <button
              type="button"
              onClick={like}
              aria-pressed={comment.liked}
              aria-label={comment.liked ? "Unlike comment" : "Like comment"}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground",
                comment.liked && "text-gold-700",
              )}
            >
              <Heart strokeWidth={1.5} className={cn("size-4", comment.liked && "fill-gold-500 text-gold-600")} aria-hidden />
              {comment.likeCount > 0 ? <span className="tabular-nums">{comment.likeCount}</span> : null}
            </button>
            {onReply ? (
              <button type="button" onClick={onReply} className="h-8 rounded-md px-2 text-[0.8125rem] font-semibold text-muted-foreground transition-colors hover:text-foreground">
                Reply
              </button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="More options" className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 rounded-lg p-1.5 shadow-lift">
                {comment.canEdit ? (
                  <DropdownMenuItem className="gap-2.5 px-2.5 py-2" onClick={() => setEditing(true)}>
                    <Pencil strokeWidth={1.5} /> Edit
                  </DropdownMenuItem>
                ) : null}
                {comment.canDelete ? (
                  <DropdownMenuItem className="gap-2.5 px-2.5 py-2" variant="destructive" onClick={remove}>
                    <Trash2 strokeWidth={1.5} /> Delete
                  </DropdownMenuItem>
                ) : null}
                {!comment.mine ? (
                  <DropdownMenuItem className="gap-2.5 px-2.5 py-2" onClick={() => onReport(comment.id)}>
                    <Flag strokeWidth={1.5} /> Report
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </footer>
        ) : null}
      </div>
    </article>
  );
}

/* --------------------------------- threads -------------------------------- */

type Thread = CommentDTO & { expanded?: boolean };

/**
 * The discussion on a post. Top-level comments each carry one level of
 * replies (a reply to a reply stays in the same thread, like Instagram).
 * `single` renders one full thread, for the "open thread" view.
 */
export function Discussion({
  postId,
  postPath,
  me,
  initial,
  initialHasMore,
  initialTotal,
  single = false,
}: {
  postId: string;
  postPath: string;
  me: Me;
  initial: CommentDTO[];
  initialHasMore: boolean;
  /** Shows the "Discussion" heading with a count that follows what the member posts or deletes. */
  initialTotal?: number;
  single?: boolean;
}) {
  const [threads, setThreads] = useState<Thread[]>(() => initial.map((c) => ({ ...c, expanded: single })));
  const [total, setTotal] = useState(initialTotal ?? 0);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [sort, setSort] = useState<CommentSort>("top");
  const [replyingTo, setReplyingTo] = useState<{ rootId: string; parentId: string; name: string } | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  // One clock reading for the whole list, so relative times are consistent.
  const [now] = useState(() => new Date());

  const patch = (id: string, fn: (thread: Thread) => Thread) => setThreads((list) => list.map((t) => (t.id === id ? fn(t) : t)));

  async function load(nextSort: CommentSort, offset: number) {
    const response = await fetch(`/api/comments?post=${postId}&sort=${nextSort}&offset=${offset}`, { cache: "no-store" });
    if (!response.ok) {
      toast.error("The discussion could not be loaded. Please try again.");
      return;
    }
    const data = (await response.json()) as { comments: CommentDTO[]; hasMore: boolean };
    setThreads((list) => (offset === 0 ? data.comments : [...list, ...data.comments.filter((c) => !list.some((t) => t.id === c.id))]));
    setHasMore(data.hasMore);
  }

  function expand(rootId: string) {
    startLoading(async () => {
      const response = await fetch(`/api/comments?thread=${rootId}`, { cache: "no-store" });
      if (!response.ok) return void toast.error("Replies could not be loaded.");
      const data = (await response.json()) as { root: CommentDTO; replies: CommentDTO[] };
      patch(rootId, (t) => ({ ...t, ...data.root, replies: data.replies, expanded: true }));
    });
  }

  async function post(body: string, parentId: string | null, rootId: string | null): Promise<boolean> {
    const result = await createComment({ postId, parentId, body });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    if (rootId) patch(rootId, (t) => ({ ...t, replyCount: t.replyCount + 1, replies: [...t.replies, result.data] }));
    else setThreads((list) => [{ ...result.data, expanded: true }, ...list]);
    setTotal((n) => n + 1);
    setReplyingTo(null);
    return true;
  }

  function removed(id: string) {
    setTotal((n) => Math.max(0, n - 1));
    setThreads((list) =>
      list.flatMap((t) => {
        if (t.id === id) return t.replyCount > 0 ? [{ ...t, state: "deleted" as const, body: "" }] : [];
        if (t.replies.some((r) => r.id === id)) return [{ ...t, replyCount: Math.max(0, t.replyCount - 1), replies: t.replies.filter((r) => r.id !== id) }];
        return [t];
      }),
    );
  }

  return (
    <div>
      {initialTotal !== undefined ? (
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 id="discussion-heading" className="type-display-sm">
            Discussion
          </h2>
          <p className="type-caption text-muted-foreground">{pluralize(total, "comment")} · members only</p>
        </div>
      ) : null}

      {!single ? (
        <Composer me={me} placeholder="Add to the discussion" submitLabel="Post" onSubmit={(body) => post(body, null, null)} />
      ) : null}

      {!single && threads.length > 1 ? (
        <div className="mt-8 flex items-center gap-1 border-b pb-3" role="group" aria-label="Sort comments">
          {(["top", "new"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={sort === option}
              disabled={loading}
              onClick={() => {
                setSort(option);
                startLoading(() => load(option, 0));
              }}
              className={cn(
                "h-8 rounded-md px-3 text-[0.8125rem] font-semibold transition-colors",
                sort === option ? "bg-navy-900 text-paper" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "top" ? "Top" : "Newest"}
            </button>
          ))}
        </div>
      ) : null}

      {threads.length === 0 ? (
        <p className="type-small mt-8 rounded-lg border border-dashed px-5 py-8 text-center text-muted-foreground">
          No one has commented yet. Start the discussion — how do you read this ruling?
        </p>
      ) : (
        <ol className={cn("space-y-8", single ? "" : "mt-8")}>
          {threads.map((thread) => {
            const hiddenReplies = thread.replyCount - thread.replies.length;
            return (
              <li key={thread.id}>
                <CommentItem
                  comment={thread}
                  me={me}
                  now={now}
                  onReply={thread.state === "visible" ? () => setReplyingTo({ rootId: thread.id, parentId: thread.id, name: thread.author.name }) : undefined}
                  onChanged={(next) => patch(thread.id, (t) => ({ ...t, ...next, replies: t.replies }))}
                  onRemoved={removed}
                  onReport={setReporting}
                />

                {thread.replies.length > 0 || hiddenReplies > 0 || replyingTo?.rootId === thread.id ? (
                  <div className="mt-5 ml-4 space-y-5 border-l border-gold-600/30 pl-5 sm:ml-11">
                    {thread.replies.map((reply) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        me={me}
                        now={now}
                        onReply={reply.state === "visible" ? () => setReplyingTo({ rootId: thread.id, parentId: reply.id, name: reply.author.name }) : undefined}
                        onChanged={(next) => patch(thread.id, (t) => ({ ...t, replies: t.replies.map((r) => (r.id === next.id ? next : r)) }))}
                        onRemoved={removed}
                        onReport={setReporting}
                      />
                    ))}

                    {hiddenReplies > 0 && !thread.expanded ? (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <button type="button" onClick={() => expand(thread.id)} disabled={loading} className="text-[0.8125rem] font-semibold text-gold-text hover:underline">
                          View {hiddenReplies} more {hiddenReplies === 1 ? "reply" : "replies"}
                        </button>
                        <Link href={`${postPath}/thread/${thread.id}`} className="text-[0.8125rem] font-semibold text-muted-foreground hover:text-foreground hover:underline">
                          Open thread
                        </Link>
                      </div>
                    ) : null}

                    {replyingTo?.rootId === thread.id ? (
                      <Composer
                        me={me}
                        placeholder={`Reply to ${replyingTo.name}`}
                        submitLabel="Reply"
                        autoFocus
                        onCancel={() => setReplyingTo(null)}
                        onSubmit={(body) => post(body, replyingTo.parentId, thread.id)}
                      />
                    ) : null}
                  </div>
                ) : null}

                {single && replyingTo?.rootId !== thread.id && thread.state === "visible" ? (
                  <div className="mt-6 ml-4 border-l border-gold-600/30 pl-5 sm:ml-11">
                    <Composer me={me} placeholder={`Reply to ${thread.author.name}`} submitLabel="Reply" onSubmit={(body) => post(body, thread.id, thread.id)} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {hasMore && !single ? (
        <div className="mt-8 text-center">
          <Button variant="outline" disabled={loading} onClick={() => startLoading(() => load(sort, threads.length))}>
            {loading ? <Loader2 className="animate-spin" /> : null}
            Show more comments
          </Button>
        </div>
      ) : null}

      <ReportDialog commentId={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}
