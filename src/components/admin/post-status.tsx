import { Badge } from "@/components/ui/badge";

/* Shared by server pages and client tables (this module has no "use client"). */

const POST_STATUS = {
  published: { label: "Published", variant: "navy" },
  draft: { label: "Draft", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "gold" },
  archived: { label: "Archived", variant: "outline" },
} as const;

export type PostStatus = keyof typeof POST_STATUS;

export function PostStatusBadge({ status }: { status: PostStatus }) {
  return <Badge variant={POST_STATUS[status].variant}>{POST_STATUS[status].label}</Badge>;
}
