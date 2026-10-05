import Link from "next/link";

import { PostActions } from "@/components/engagement/post-actions";
import { OutcomePill } from "@/components/posts/outcome-pill";
import { SectionChips } from "@/components/posts/section-chips";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PostCard } from "@/server/queries/posts";

/**
 * A ruling in a list. The whole card is one link (stretched over the card);
 * chips sit above it so they stay individually clickable.
 */
export function CaseCard({
  post,
  className,
  headingLevel: Heading = "h3",
  compact = false,
}: {
  post: PostCard;
  className?: string;
  headingLevel?: "h2" | "h3";
  compact?: boolean;
}) {
  const c = post.caseLaw;
  if (!c) return null;

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card p-5 shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-out-quart hover:-translate-y-0.5 hover:border-gold-600/60 hover:shadow-lift sm:p-6",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-6 top-0 h-px origin-left scale-x-0 bg-gold-500 transition-transform duration-500 ease-out-expo group-hover:scale-x-100"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="type-caption font-medium text-muted-foreground">
          <span className="text-foreground">{c.court.shortName}</span>
          <span aria-hidden className="mx-2 text-gold-600">
            ◆
          </span>
          <time dateTime={c.decisionDate}>{formatDate(c.decisionDate)}</time>
        </p>
        <div className="flex items-center gap-1.5">
          {post.featured ? (
            <span className="inline-flex h-6 items-center rounded-xs bg-gold-500 px-2 text-[0.6875rem] font-semibold tracking-[0.04em] text-navy-900">
              Featured
            </span>
          ) : null}
          <OutcomePill side={c.outcomeSide} remanded={c.remanded} />
        </div>
      </div>

      <Heading className={cn("mt-3 font-display font-semibold text-foreground", compact ? "text-lg leading-snug" : "text-xl leading-snug sm:text-[1.375rem]")}>
        <Link href={`/case-laws/${post.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring">
          {post.title}
        </Link>
      </Heading>

      <p className={cn("mt-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground", compact ? "line-clamp-2" : "line-clamp-3")}>
        {post.excerpt}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <SectionChips refs={c.sectionRefs} max={compact ? 2 : 4} />
        <PostActions
          target={{ id: post.id, slug: post.slug, title: post.title, path: `/case-laws/${post.slug}` }}
          counts={{ likes: post.stats.likes, comments: post.stats.comments }}
          className="-mr-1.5"
        />
      </div>
    </article>
  );
}
