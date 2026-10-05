import { Badge } from "@/components/ui/badge";

export const ROW_STATUS_LABEL = {
  new: "New",
  changed: "Changed",
  unchanged: "Unchanged",
  skipped_manual_edit: "Edited in admin",
  invalid: "Invalid",
  duplicate: "Duplicate",
} as const;

export type RowStatusKey = keyof typeof ROW_STATUS_LABEL;

const ROW_VARIANT: Record<RowStatusKey, "default" | "navy" | "secondary" | "gold" | "destructive"> = {
  new: "default",
  changed: "navy",
  unchanged: "secondary",
  skipped_manual_edit: "gold",
  invalid: "destructive",
  duplicate: "destructive",
};

export function RowStatusBadge({ status }: { status: RowStatusKey }) {
  return <Badge variant={ROW_VARIANT[status]}>{ROW_STATUS_LABEL[status]}</Badge>;
}

const BATCH_LABEL = {
  previewed: "Awaiting review",
  committing: "Importing",
  committed: "Imported",
  failed: "Failed",
  discarded: "Discarded",
} as const;

export function BatchStatusBadge({ status }: { status: keyof typeof BATCH_LABEL }) {
  const variant = status === "committed" ? "navy" : status === "previewed" ? "default" : status === "failed" ? "destructive" : "secondary";
  return <Badge variant={variant}>{BATCH_LABEL[status]}</Badge>;
}
