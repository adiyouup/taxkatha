import Link from "next/link";
import { LockKeyhole } from "lucide-react";

import { SealRings } from "@/components/brand/motif";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PostCard } from "@/server/queries/posts";

/** An editorial article in a list. Falls back to a branded panel when there is no cover image. */
export function InsightCard({
  post,
  className,
  headingLevel: Heading = "h3",
  large = false,
}: {
  post: PostCard;
  className?: string;
  headingLevel?: "h2" | "h3";
  large?: boolean;
}) {
  const insight = post.insight;
  if (!insight) return null;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-out-quart hover:-translate-y-0.5 hover:border-gold-600/60 hover:shadow-lift",
        className,
      )}
    >
      <div className={cn("relative overflow-hidden bg-navy-900", large ? "aspect-[16/8]" : "aspect-[16/9]")}>
        {insight.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- editorial image stored at upload size
          <img
            src={insight.coverImageUrl}
            alt={insight.coverImageAlt ?? ""}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]"
          />
        ) : (
          <div className="theme-navy grain flex size-full items-end p-6">
            <SealRings className="pointer-events-none absolute -top-16 -right-16 w-64 opacity-60" />
            <span className="type-eyebrow relative text-[0.6875rem] text-gold-500">TaxKatha Insights</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="type-caption flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-muted-foreground">
          <span className="type-eyebrow text-[0.625rem] text-gold-text">{post.topic?.name ?? "Insight"}</span>
          {insight.membersOnly ? (
            <span className="inline-flex items-center gap-1 text-gold-800">
              <LockKeyhole className="size-3" aria-hidden /> Members
            </span>
          ) : null}
        </p>
        <Heading className={cn("mt-3 font-display font-semibold text-foreground", large ? "text-2xl leading-snug sm:text-[1.75rem]" : "text-xl leading-snug")}>
          <Link href={`/insights/${post.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring">
            {post.title}
          </Link>
        </Heading>
        <p className={cn("mt-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground", large ? "line-clamp-3" : "line-clamp-2")}>{post.excerpt}</p>
        <p className="type-caption mt-auto pt-5 text-muted-foreground">
          {insight.authorName ? <span className="font-medium text-foreground">{insight.authorName}</span> : null}
          {insight.authorName ? <span className="mx-2 text-gold-600">◆</span> : null}
          {post.publishedAt ? <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time> : null}
          <span className="mx-2 text-gold-600">◆</span>
          {insight.readingMinutes} min read
        </p>
      </div>
    </article>
  );
}
