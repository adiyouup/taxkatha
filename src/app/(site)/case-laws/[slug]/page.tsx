import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";

import { SignInGate } from "@/components/auth/sign-in-gate";
import { Discussion } from "@/components/comments/discussion";
import { LivePostActions } from "@/components/engagement/live-post-actions";
import { ViewBeacon } from "@/components/engagement/view-beacon";
import { Diamond, GoldRule } from "@/components/brand/motif";
import { CaseCard } from "@/components/posts/case-card";
import { OutcomePill } from "@/components/posts/outcome-pill";
import { SectionChips } from "@/components/posts/section-chips";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateLong } from "@/lib/format";
import { DOMAIN_LABEL, outcomeLong } from "@/lib/labels";
import { splitHeadnotes, splitPoints, splitSubjectTrail, truncate } from "@/lib/legal-text";
import { siteConfig } from "@/lib/site";
import { getViewer } from "@/server/auth/dal";
import { listComments } from "@/server/comments";
import { getCaseBody, getCaseTeaser, getLatestSlugs, getRelatedCases, resolveOldSlug, type CaseTeaser } from "@/server/queries/posts";

type Props = PageProps<"/case-laws/[slug]">;

/** The newest rulings are prerendered; older ones render on first visit and are then cached. */
export async function generateStaticParams() {
  const slugs = await getLatestSlugs("case_law", 200);
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: "placeholder" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getCaseTeaser(slug);
  if (!post) return { title: "Ruling not found", robots: { index: false } };

  const title = `${post.title} — ${post.caseLaw.court.shortName}`;
  const description = truncate(splitHeadnotes(post.excerpt)[0] ?? post.excerpt, 158);
  return {
    title,
    description,
    alternates: { canonical: `/case-laws/${post.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/case-laws/${post.slug}`,
      publishedTime: `${post.caseLaw.decisionDate}T00:00:00.000Z`,
      section: post.topic?.name,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/* ------------------------------ Gated section ----------------------------- */

function Points({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3.5">
          <Diamond className="mt-[0.6em] size-1.5 text-gold-600" />
          <span className="prose-legal">{item}</span>
        </li>
      ))}
    </ul>
  );
}

async function GatedAnalysis({ postId, slug }: { postId: string; slug: string }) {
  // The session is checked BEFORE any gated text is fetched.
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <div id="discussion" className="scroll-mt-28">
        <SignInGate next={`/case-laws/${slug}`} />
      </div>
    );
  }

  const [body, discussion] = await Promise.all([getCaseBody(postId), listComments(postId, viewer, { sort: "top", offset: 0 })]);
  if (!body) return null;
  const background = splitSubjectTrail(body.background);
  const decision = splitPoints(body.decision);

  return (
    <div className="space-y-12">
      {background.points.length > 0 ? (
        <section aria-labelledby="background-heading">
          <h2 id="background-heading" className="type-display-sm">
            Background and issue
          </h2>
          {background.trail.length > 0 ? (
            <p className="type-caption mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-gold-text">
              {background.trail.map((label, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 ? <ChevronRight className="size-3" aria-hidden /> : null}
                  {label}
                </span>
              ))}
            </p>
          ) : null}
          <div className="mt-5">
            <Points items={background.points} />
          </div>
        </section>
      ) : null}

      {decision.length > 0 ? (
        <section aria-labelledby="decision-heading">
          <h2 id="decision-heading" className="type-display-sm">
            Decision
          </h2>
          <div className="mt-5">
            <Points items={decision} />
          </div>
        </section>
      ) : null}

      <section id="discussion" aria-labelledby="discussion-heading" className="scroll-mt-28 border-t pt-10">
        <Discussion
          postId={postId}
          postPath={`/case-laws/${slug}`}
          me={{ id: viewer.id, name: viewer.name, image: viewer.image }}
          initial={discussion.comments}
          initialHasMore={discussion.hasMore}
          initialTotal={discussion.total}
        />
      </section>
    </div>
  );
}

function GateSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-6 w-56" />
      {[100, 94, 97, 82].map((w, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

/* --------------------------------- Layout --------------------------------- */

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-3">
      <dt className="type-caption text-muted-foreground">{term}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

async function Related({ postId }: { postId: string }) {
  const related = await getRelatedCases(postId, 3);
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related-heading" className="mt-10">
      <h2 id="related-heading" className="type-eyebrow text-[0.6875rem] text-gold-text">
        Related rulings
      </h2>
      <div className="mt-4 grid gap-3">
        {related.map((post) => (
          <CaseCard key={post.id} post={post} compact className="p-4 sm:p-5" />
        ))}
      </div>
    </section>
  );
}

function jsonLd(post: CaseTeaser) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: truncate(post.title, 110),
        description: truncate(post.excerpt, 300),
        datePublished: post.caseLaw.decisionDate,
        dateModified: post.publishedAt?.toISOString() ?? post.caseLaw.decisionDate,
        articleSection: post.topic?.name ?? "Case law",
        inLanguage: "en-IN",
        mainEntityOfPage: `${siteConfig.url}/case-laws/${post.slug}`,
        // The headnote is free; the full analysis needs a (free) membership.
        isAccessibleForFree: false,
        publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
        about: [post.caseLaw.court.name, ...post.caseLaw.sectionRefs.slice(0, 5)],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Case laws", item: `${siteConfig.url}/case-laws` },
          { "@type": "ListItem", position: 2, name: post.caseLaw.court.shortName, item: `${siteConfig.url}/courts/${post.caseLaw.court.slug}` },
          { "@type": "ListItem", position: 3, name: post.title },
        ],
      },
    ],
  };
}

async function CaseContent({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const post = await getCaseTeaser(slug);
  if (!post) {
    const current = await resolveOldSlug(slug);
    if (current) permanentRedirect(`/case-laws/${current}`);
    notFound();
  }

  const c = post.caseLaw;
  const headnotes = splitHeadnotes(post.excerpt);

  return (
    <article>
      <ViewBeacon postId={post.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(post)).replace(/</g, "\\u003c") }}
      />

      <header className="theme-navy grain relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(52rem_26rem_at_88%_-12%,rgb(212_175_55/0.11),transparent_62%)]" />
        <div className="container-wide relative pt-28 pb-12 sm:pt-32 sm:pb-14">
          <nav aria-label="Breadcrumb">
            <ol className="type-caption flex flex-wrap items-center gap-1.5 text-muted-foreground">
              <li>
                <Link href="/case-laws" className="hover:text-paper hover:underline">
                  Case laws
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3.5" />
              </li>
              <li>
                <Link href={`/courts/${c.court.slug}`} className="hover:text-paper hover:underline">
                  {c.court.shortName}
                </Link>
              </li>
            </ol>
          </nav>

          <p className="type-eyebrow mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-gold-500">
            <span>{c.court.name}</span>
            <Diamond className="size-1.5" />
            <time dateTime={c.decisionDate}>{formatDateLong(c.decisionDate)}</time>
          </p>
          <h1 className="type-display-lg mt-5 max-w-4xl text-paper">{post.title}</h1>
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
            <OutcomePill side={c.outcomeSide} remanded={c.remanded} />
            {c.caseNumber ? <p className="type-small text-muted-foreground">{c.caseNumber}</p> : null}
          </div>
          <LivePostActions
            className="mt-8"
            target={{ id: post.id, slug: post.slug, title: post.title, path: `/case-laws/${post.slug}` }}
            cached={{ likes: post.stats.likes, comments: post.stats.comments }}
          />
        </div>
        <div className="h-px bg-linear-to-r from-transparent via-gold-500/50 to-transparent" />
      </header>

      <div className="container-wide grid gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16 lg:py-16">
        <div className="min-w-0 max-w-3xl">
          <section aria-labelledby="headnote-heading" className="rounded-xl border border-l-2 border-l-gold-500 bg-card p-6 shadow-soft sm:p-8">
            <h2 id="headnote-heading" className="type-eyebrow text-[0.6875rem] text-gold-text">
              The ruling in brief
            </h2>
            <div className="mt-4 space-y-4">
              {headnotes.map((note, i) => (
                <p key={i} className="font-display text-xl leading-relaxed text-foreground sm:text-[1.375rem] sm:leading-[1.55]">
                  {note}
                </p>
              ))}
            </div>
            {post.editorNote ? (
              <p className="type-small mt-6 border-t pt-5 text-muted-foreground">
                <span className="font-semibold text-foreground">Editor&apos;s note. </span>
                {post.editorNote}
              </p>
            ) : null}
          </section>

          {c.sectionRefs.length > 0 ? (
            <section aria-labelledby="provisions-heading" className="mt-10">
              <h2 id="provisions-heading" className="type-display-sm">
                Provisions considered
              </h2>
              <SectionChips refs={c.sectionRefs} max={16} className="mt-4" />
              {c.relevantSections ? <p className="type-small mt-4 text-muted-foreground">{c.relevantSections}</p> : null}
            </section>
          ) : null}

          <GoldRule className="my-10" />

          <Suspense fallback={<GateSkeleton />}>
            <GatedAnalysis postId={post.id} slug={post.slug} />
          </Suspense>

          <p className="type-caption mt-12 border-t pt-6 text-muted-foreground">
            This summary is for general information and is not legal advice. Read the full decision and the applicable
            law before relying on it.
          </p>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section aria-labelledby="details-heading" className="rounded-xl border bg-card p-5 shadow-soft sm:p-6">
            <h2 id="details-heading" className="type-eyebrow text-[0.6875rem] text-gold-text">
              Case details
            </h2>
            <dl className="mt-2 divide-y">
              <Detail term="Forum">
                <Link href={`/courts/${c.court.slug}`} className="underline-offset-4 hover:text-gold-text hover:underline">
                  {c.court.name}
                </Link>
              </Detail>
              {c.bench ? <Detail term="Bench">{c.bench}</Detail> : null}
              <Detail term="Decided on">
                <time dateTime={c.decisionDate}>{formatDate(c.decisionDate)}</time>
              </Detail>
              <Detail term="Case no.">{c.caseNumber || "Not stated"}</Detail>
              <Detail term="Outcome">{outcomeLong(c.outcomeSide, c.remanded)}</Detail>
              <Detail term="Tax area">{c.domainLabel || DOMAIN_LABEL[post.domain]}</Detail>
              {post.topic ? (
                <Detail term="Topic">
                  <Link href={`/topics/${post.topic.slug}`} className="underline-offset-4 hover:text-gold-text hover:underline">
                    {post.topic.name}
                  </Link>
                </Detail>
              ) : null}
            </dl>
          </section>

          <Suspense fallback={null}>
            <Related postId={post.id} />
          </Suspense>
        </aside>
      </div>
    </article>
  );
}

function PageSkeleton() {
  return (
    <div aria-hidden>
      <div className="theme-navy">
        <div className="container-wide space-y-5 pt-28 pb-14 sm:pt-32">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-12 w-4/5" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
      <div className="container-wide max-w-3xl space-y-4 py-12">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
      </div>
    </div>
  );
}

export default function CasePage({ params }: Props) {
  // `params` is awaited inside the boundary so unlisted slugs still get an instant shell.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CaseContent params={params} />
    </Suspense>
  );
}
