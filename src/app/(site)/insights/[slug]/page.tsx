import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";

import { SignInGate } from "@/components/auth/sign-in-gate";
import { Diamond, GoldRule } from "@/components/brand/motif";
import { Discussion } from "@/components/comments/discussion";
import { LivePostActions } from "@/components/engagement/live-post-actions";
import { ViewBeacon } from "@/components/engagement/view-beacon";
import { ReadingProgress } from "@/components/motion/reading-progress";
import { CaseCard } from "@/components/posts/case-card";
import { RichText } from "@/components/rich-text/render";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateLong } from "@/lib/format";
import { truncate } from "@/lib/legal-text";
import { docHeadings } from "@/lib/rich-text/schema";
import { siteConfig } from "@/lib/site";
import { getViewer } from "@/server/auth/dal";
import { listComments } from "@/server/comments";
import { getInsight, getInsightBody, type InsightTeaser } from "@/server/queries/insights";
import { getCaseTeaser, getLatestSlugs, resolveOldSlug } from "@/server/queries/posts";

type Props = PageProps<"/insights/[slug]">;

export async function generateStaticParams() {
  const slugs = await getLatestSlugs("insight", 100);
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: "placeholder" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const insight = await getInsight(slug);
  if (!insight) return { title: "Insight not found", robots: { index: false } };

  const title = insight.seoTitle ?? insight.title;
  const description = insight.seoDescription ?? truncate(insight.excerpt, 158);
  return {
    title,
    description,
    alternates: { canonical: `/insights/${insight.slug}` },
    authors: insight.authorName ? [{ name: insight.authorName }] : undefined,
    openGraph: {
      type: "article",
      title,
      description,
      url: `/insights/${insight.slug}`,
      publishedTime: insight.publishedAt.toISOString(),
      modifiedTime: insight.updatedAt.toISOString(),
      section: insight.topic?.name,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** A ruling embedded in the article renders as its public case card. */
async function EmbeddedCase({ slug }: { slug: string }) {
  const post = await getCaseTeaser(slug);
  return post ? <CaseCard post={post} compact className="my-2" /> : null;
}

async function ArticleBody({ postId }: { postId: string }) {
  const doc = await getInsightBody(postId);
  if (!doc) return null;
  return <RichText doc={doc} embed={(slug) => <EmbeddedCase slug={slug} />} />;
}

/** Members-only articles: the session is checked BEFORE the body is fetched. */
async function GatedBody({ insight }: { insight: InsightTeaser }) {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <SignInGate
        next={`/insights/${insight.slug}`}
        title="This insight is for members"
        description="Membership is free. Sign in to read the full article and join the discussion."
        sections={["The full analysis"]}
      />
    );
  }
  return <ArticleBody postId={insight.id} />;
}

async function InsightDiscussion({ insight }: { insight: InsightTeaser }) {
  const viewer = await getViewer();
  if (!viewer) {
    return insight.membersOnly ? null : (
      <SignInGate
        next={`/insights/${insight.slug}#discussion`}
        title="Join the discussion"
        description="See how professionals read this, and add your own view. The discussion is free for members."
        sections={[]}
      />
    );
  }
  const discussion = await listComments(insight.id, viewer, {
    sort: "top",
    offset: 0,
  });
  return (
    <Discussion
      postId={insight.id}
      postPath={`/insights/${insight.slug}`}
      me={{ id: viewer.id, name: viewer.name, image: viewer.image }}
      initial={discussion.comments}
      initialHasMore={discussion.hasMore}
      initialTotal={discussion.total}
    />
  );
}

async function TableOfContents({ postId }: { postId: string }) {
  const doc = await getInsightBody(postId);
  const headings = doc ? docHeadings(doc).filter((h) => h.level === 2) : [];
  if (headings.length < 2) return null;
  return (
    <nav aria-label="In this article" className="rounded-xl border bg-card p-5 shadow-soft">
      <p className="type-eyebrow text-[0.6875rem] text-gold-text">In this article</p>
      <ol className="mt-3.5 space-y-2.5">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a href={`#${heading.id}`} className="gold-underline pb-0.5 text-sm leading-snug text-foreground/85 hover:text-foreground">
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function jsonLd(insight: InsightTeaser) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: truncate(insight.title, 110),
    description: truncate(insight.excerpt, 300),
    image: insight.coverImageUrl ? [insight.coverImageUrl.startsWith("/") ? `${siteConfig.url}${insight.coverImageUrl}` : insight.coverImageUrl] : undefined,
    datePublished: insight.publishedAt.toISOString(),
    dateModified: insight.updatedAt.toISOString(),
    author: insight.authorName ? { "@type": "Person", name: insight.authorName } : { "@type": "Organization", name: siteConfig.name },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    mainEntityOfPage: `${siteConfig.url}/insights/${insight.slug}`,
    isAccessibleForFree: !insight.membersOnly,
    inLanguage: "en-IN",
  };
}

async function InsightContent({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const insight = await getInsight(slug);
  if (!insight) {
    const current = await resolveOldSlug(slug);
    if (current) permanentRedirect(`/insights/${current}`);
    notFound();
  }
  const path = `/insights/${insight.slug}`;

  return (
    <article>
      <ViewBeacon postId={insight.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd(insight)).replace(/</g, "\\u003c"),
        }}
      />

      <header className="theme-navy grain relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(52rem_26rem_at_88%_-12%,rgb(212_175_55/0.11),transparent_62%)]" />
        {/* Same container as the body, so the headline and the text share a left edge. */}
        <div className="container-content relative pt-28 pb-12 sm:pt-32 sm:pb-14">
          <div className="max-w-[52rem]">
            <nav aria-label="Breadcrumb">
              <ol className="type-caption flex flex-wrap items-center gap-1.5 text-muted-foreground">
                <li>
                  <Link href="/insights" className="hover:text-paper hover:underline">
                    Insights
                  </Link>
                </li>
                {insight.topic ? (
                  <>
                    <li aria-hidden>
                      <ChevronRight className="size-3.5" />
                    </li>
                    <li>
                      <Link href={`/topics/${insight.topic.slug}`} className="hover:text-paper hover:underline">
                        {insight.topic.name}
                      </Link>
                    </li>
                  </>
                ) : null}
              </ol>
            </nav>
            <p className="type-eyebrow mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-gold-500">
              <span>Insight</span>
              <Diamond className="size-1.5" />
              <span>{insight.readingMinutes} min read</span>
              {insight.membersOnly ? (
                <>
                  <Diamond className="size-1.5" />
                  <span>Members</span>
                </>
              ) : null}
            </p>
            <h1 className="type-display-xl mt-5 text-paper">{insight.title}</h1>
            <p className="type-lede mt-6 max-w-3xl text-paper/80">{insight.excerpt}</p>
            <p className="type-small mt-7 text-muted-foreground">
              {insight.authorName ? <span className="font-semibold text-paper">{insight.authorName}</span> : "TaxKatha"}
              <span className="mx-2.5 text-gold-500">◆</span>
              <time dateTime={insight.publishedAt.toISOString()}>{formatDateLong(insight.publishedAt)}</time>
            </p>
            <LivePostActions
              className="mt-8"
              target={{ id: insight.id, slug: insight.slug, title: insight.title, path }}
              cached={{ likes: insight.stats.likes, comments: insight.stats.comments }}
            />
          </div>
        </div>
        <div className="h-px bg-linear-to-r from-transparent via-gold-500/50 to-transparent" />
      </header>

      <div className="container-content grid gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-16 lg:py-16">
        <div className="min-w-0 max-w-[42rem]">
          <ReadingProgress>
            {insight.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- editorial image stored at upload size
              <img
                src={insight.coverImageUrl}
                alt={insight.coverImageAlt ?? ""}
                className="mb-10 aspect-[16/9] w-full rounded-2xl border object-cover shadow-soft"
              />
            ) : null}

            {insight.membersOnly ? (
              <Suspense fallback={<BodySkeleton />}>
                <GatedBody insight={insight} />
              </Suspense>
            ) : (
              <ArticleBody postId={insight.id} />
            )}
          </ReadingProgress>

          <GoldRule className="my-12" />

          <section id="discussion" aria-labelledby="discussion-heading" className="scroll-mt-28">
            <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
              <InsightDiscussion insight={insight} />
            </Suspense>
          </section>

          <p className="type-caption mt-12 border-t pt-6 text-muted-foreground">
            This article is for general information and is not legal advice. Read the decisions it discusses and the applicable law before relying on it.
          </p>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">{insight.membersOnly ? null : <TableOfContents postId={insight.id} />}</div>
        </aside>
      </div>
    </article>
  );
}

function BodySkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[100, 96, 98, 90, 94, 72].map((w, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

export default function InsightPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div aria-hidden>
          <div className="theme-navy">
            <div className="container-content pt-28 pb-14 sm:pt-32">
              <div className="max-w-[52rem] space-y-5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-14 w-4/5" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          </div>
          <div className="container-content py-12">
            <div className="max-w-[42rem]">
              <BodySkeleton />
            </div>
          </div>
        </div>
      }
    >
      <InsightContent params={params} />
    </Suspense>
  );
}
