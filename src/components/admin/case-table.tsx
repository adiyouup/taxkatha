"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, EyeOff, Loader2, PenLine, Send, Star, StarOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { PostStatusBadge } from "@/components/admin/post-status";
import { OutcomePill } from "@/components/posts/outcome-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCompact, formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bulkPostAction } from "@/server/actions/admin-posts";
import type { AdminCaseRow } from "@/server/queries/admin-posts";

type BulkAction = "publish" | "unpublish" | "archive" | "delete" | "feature" | "unfeature";

const ACTIONS: { action: BulkAction; label: string; icon: typeof Send }[] = [
  { action: "publish", label: "Publish", icon: Send },
  { action: "unpublish", label: "Unpublish", icon: EyeOff },
  { action: "archive", label: "Archive", icon: Archive },
  { action: "feature", label: "Feature", icon: Star },
  { action: "unfeature", label: "Unfeature", icon: StarOff },
];

const DONE = {
  publish: "published",
  unpublish: "moved to drafts",
  archive: "archived",
  delete: "deleted",
  feature: "featured",
  unfeature: "removed from featured",
} as const;

/** The case-law table with row selection and bulk actions. */
export function CaseTable({ rows }: { rows: AdminCaseRow[] }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [running, setRunning] = useState<BulkAction | null>(null);
  const [, startTransition] = useTransition();
  const allRef = useRef<HTMLInputElement>(null);

  // A new page of results (or a refreshed one) starts with nothing selected.
  const [shown, setShown] = useState(rows);
  if (shown !== rows) {
    setShown(rows);
    setSelected(new Set());
  }

  const all = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const some = selected.size > 0 && !all;
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  }, [some]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(action: BulkAction) {
    const ids = [...selected];
    setRunning(action);
    startTransition(async () => {
      const result = await bulkPostAction({ ids, action });
      setRunning(null);
      setConfirmDelete(false);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${pluralize(result.data.count, "ruling")} ${DONE[action]}.`);
      setSelected(new Set());
    });
  }

  return (
    <div>
      <div
        className={cn(
          "flex min-h-14 flex-wrap items-center gap-2 border-b px-5 py-2.5 sm:px-6",
          selected.size > 0 ? "bg-navy-900 text-paper" : "bg-transparent",
        )}
        aria-live="polite"
      >
        {selected.size > 0 ? (
          <>
            <p className="mr-2 text-sm font-semibold">{pluralize(selected.size, "ruling")} selected</p>
            {ACTIONS.map(({ action, label, icon: Icon }) => (
              <Button
                key={action}
                size="sm"
                variant="ghost"
                disabled={running !== null}
                onClick={() => run(action)}
                className="text-paper hover:bg-white/10 hover:text-paper"
              >
                {running === action ? <Loader2 className="animate-spin" /> : <Icon strokeWidth={1.5} />}
                {label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              disabled={running !== null}
              onClick={() => setConfirmDelete(true)}
              className="text-red-200 hover:bg-red-500/15 hover:text-red-100"
            >
              <Trash2 strokeWidth={1.5} /> Delete
            </Button>
            <Button size="sm" variant="link" onClick={() => setSelected(new Set())} className="ml-auto text-paper/70 hover:text-paper">
              Clear
            </Button>
          </>
        ) : (
          <p className="type-caption text-muted-foreground">Select rulings to publish, unpublish, archive, feature or delete them together.</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="w-12 py-3 pr-2 pl-5 sm:pl-6">
                <input
                  ref={allRef}
                  type="checkbox"
                  aria-label="Select all rulings on this page"
                  checked={all}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((row) => row.id)))}
                  className="size-4 cursor-pointer align-middle accent-(--color-gold-700)"
                />
              </th>
              <th scope="col" className="type-caption py-3 pr-4 font-semibold text-muted-foreground">
                Ruling
              </th>
              <th scope="col" className="type-caption py-3 pr-4 font-semibold text-muted-foreground">
                Status
              </th>
              <th scope="col" className="type-caption py-3 pr-4 font-semibold text-muted-foreground">
                Outcome
              </th>
              <th scope="col" className="type-caption py-3 pr-4 text-right font-semibold text-muted-foreground">
                Views
              </th>
              <th scope="col" className="type-caption py-3 pr-4 text-right font-semibold text-muted-foreground">
                Likes
              </th>
              <th scope="col" className="type-caption py-3 pr-5 text-right font-semibold text-muted-foreground sm:pr-6">
                Comments
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const checked = selected.has(row.id);
              return (
                <tr key={row.id} className={cn("border-b align-top transition-colors last:border-0 hover:bg-muted/40", checked && "bg-gold-50/70 hover:bg-gold-50")}>
                  <td className="py-3.5 pr-2 pl-5 sm:pl-6">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.title}`}
                      checked={checked}
                      onChange={() => toggle(row.id)}
                      className="mt-0.5 size-4 cursor-pointer accent-(--color-gold-700)"
                    />
                  </td>
                  <td className="max-w-[30rem] py-3.5 pr-4">
                    <Link href={`/admin/case-laws/${row.id}`} className="font-semibold leading-snug text-foreground hover:text-gold-text hover:underline">
                      <span className="line-clamp-2">{row.title}</span>
                    </Link>
                    <p className="type-caption mt-1 text-muted-foreground">
                      {row.court} · {formatDate(row.decisionDate)}
                      {row.topic ? (
                        <>
                          {" · "}
                          <span className={cn(!row.topicReviewed && "text-gold-text")}>
                            {row.topic}
                            {row.topicReviewed ? "" : " (unreviewed)"}
                          </span>
                        </>
                      ) : (
                        " · No topic"
                      )}
                    </p>
                  </td>
                  <td className="py-3.5 pr-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PostStatusBadge status={row.status} />
                      {row.featured ? (
                        <Badge variant="gold">
                          <Star /> Featured
                        </Badge>
                      ) : null}
                      {row.edited ? (
                        <span title="Edited in the admin: imports will not overwrite it" className="inline-flex items-center text-muted-foreground">
                          <PenLine className="size-3.5" aria-hidden />
                          <span className="sr-only">Edited in the admin</span>
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <OutcomePill side={row.outcomeSide} remanded={row.remanded} />
                  </td>
                  <td className="py-3.5 pr-4 text-right tabular-nums">{formatCompact(row.views)}</td>
                  <td className="py-3.5 pr-4 text-right tabular-nums">{formatCompact(row.likes)}</td>
                  <td className="py-3.5 pr-5 text-right tabular-nums sm:pr-6">{formatCompact(row.comments)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${pluralize(selected.size, "ruling")}?`}
        description="Their discussions, likes and saves are deleted with them, and their pages stop working. This cannot be undone — to take rulings off the site but keep them, unpublish or archive them instead."
        confirmLabel="Delete permanently"
        destructive
        pending={running === "delete"}
        onConfirm={() => run("delete")}
      />
    </div>
  );
}
