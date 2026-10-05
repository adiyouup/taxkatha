import Link from "next/link";
import { ArrowRight, ArrowUpRight, Heart, MessageCircle } from "lucide-react";

import { SealRings } from "@/components/brand/motif";
import { Section, SectionHeading } from "@/components/layout/section";
import { CountUp } from "@/components/motion/count-up";
import { LineReveal, Reveal } from "@/components/motion/reveal";
import { CaseCard } from "@/components/posts/case-card";
import { InsightCard } from "@/components/posts/insight-card";
import { OutcomePill } from "@/components/posts/outcome-pill";
import { SectionChips } from "@/components/posts/section-chips";
import { buttonVariants } from "@/components/ui/button";
import { formatCompact, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DirectoryFacets, PostCard, SiteStats, Trending } from "@/server/queries/posts";

const postHref = (post: PostCard) => `/${post.type === "case_law" ? "case-laws" : "insights"}/${post.slug}`;

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-gold-text">
      <span className="gold-underline pb-0.5">{children}</span>
      <ArrowRight strokeWidth={1.75} className="size-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

/* -------------------------------- Featured -------------------------------- */

/** Editor-boosted posts: one lead story and two supporting ones. */
export function FeaturedSection({ posts, boosted }: { posts: PostCard[]; boosted: boolean }) {
  if (posts.length === 0) return null;
  const [lead, ...rest] = posts;
  const leadCase = lead!.caseLaw;

  return (
    <Section>
      <div className="container-wide">
        <Reveal>
          <SectionHeading
            eyebrow={boosted ? "Editors’ selection" : "From the Supreme Court"}
            title={boosted ? "Rulings worth your attention" : "The latest word from the top court"}
            action={<TextLink href="/case-laws">All case laws</TextLink>}
          />
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Reveal>
            <article className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-gold-600/40 bg-card p-7 shadow-soft transition-[box-shadow,transform] duration-300 ease-out-quart hover:-translate-y-0.5 hover:shadow-lift sm:p-10">
              <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-gold-500 via-gold-300 to-transparent" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {lead!.featured ? (
                    <span className="inline-flex h-6 items-center rounded-xs bg-gold-500 px-2 text-[0.6875rem] font-semibold tracking-[0.04em] text-navy-900">
                      Featured
                    </span>
                  ) : null}
                  {leadCase ? <OutcomePill side={leadCase.outcomeSide} remanded={leadCase.remanded} /> : null}
                </div>
                {leadCase ? (
                  <p className="type-caption mt-5 font-medium text-muted-foreground">
                    <span className="text-foreground">{leadCase.court.name}</span>
                    <span aria-hidden className="mx-2 text-gold-600">
                      ◆
                    </span>
                    <time dateTime={leadCase.decisionDate}>{formatDate(leadCase.decisionDate)}</time>
                  </p>
                ) : null}
                <h3 className="type-display-md mt-3 text-foreground">
                  <Link href={postHref(lead!)} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-ring">
                    {lead!.title}
                  </Link>
                </h3>
                <p className="type-body mt-4 line-clamp-4 text-muted-foreground">{lead!.excerpt}</p>
                {lead!.editorNote ? (
                  <p className="type-small mt-5 border-l-2 border-gold-500 pl-4 text-foreground">
                    <span className="font-semibold">Why it matters. </span>
                    {lead!.editorNote}
                  </p>
                ) : null}
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                {leadCase ? <SectionChips refs={leadCase.sectionRefs} max={4} /> : <span />}
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-text">
                  Read the ruling <ArrowUpRight strokeWidth={1.75} className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </article>
          </Reveal>

          <div className="grid gap-5">
            {rest.slice(0, 2).map((post, i) => (
              <Reveal key={post.id} delay={0.08 * (i + 1)} className="h-full">
                <CaseCard post={post} compact className="h-full" />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------- Trending -------------------------------- */

/** A horizontal, snap-scrolling rail with large serif rank numerals. */
export function TrendingSection({ trending }: { trending: Trending }) {
  if (trending.posts.length === 0) return null;

  return (
    <Section tint className="overflow-hidden">
      <div className="container-wide">
        <Reveal>
          <SectionHeading
            eyebrow={trending.hasSignal ? "Trending this week" : "Just in"}
            title={trending.hasSignal ? "What the profession is reading" : "The latest decisions"}
            description={
              trending.hasSignal
                ? "Ranked by what members read, save, discuss and share."
                : "The newest rulings, summarised as they are reported."
            }
            action={<TextLink href={trending.hasSignal ? "/case-laws?sort=discussed" : "/case-laws"}>See them all</TextLink>}
          />
        </Reveal>
      </div>

      <Reveal className="mt-12">
        <ol
          aria-label={trending.hasSignal ? "Trending posts" : "Latest rulings"}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-6 [scrollbar-width:none] sm:scroll-px-6 sm:px-6 lg:scroll-px-[max(2rem,calc((100vw-80rem)/2+2rem))] lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))] [&::-webkit-scrollbar]:hidden"
        >
          {trending.posts.map((post, index) => (
            <li key={post.id} className="w-[19.5rem] shrink-0 snap-start sm:w-[22rem]">
              <article className="group relative flex h-full flex-col rounded-xl border bg-card p-6 shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-out-quart hover:-translate-y-0.5 hover:border-gold-600/60 hover:shadow-lift">
                <div className="flex items-start justify-between gap-4">
                  <span className="type-numeral text-5xl leading-none text-gold-700/90" aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {post.caseLaw ? <OutcomePill side={post.caseLaw.outcomeSide} remanded={post.caseLaw.remanded} className="justify-end" /> : null}
                </div>
                {post.caseLaw ? (
                  <p className="type-caption mt-5 font-medium text-muted-foreground">
                    <span className="text-foreground">{post.caseLaw.court.shortName}</span>
                    <span aria-hidden className="mx-2 text-gold-600">
                      ◆
                    </span>
                    <time dateTime={post.caseLaw.decisionDate}>{formatDate(post.caseLaw.decisionDate)}</time>
                  </p>
                ) : null}
                <h3 className="mt-2 line-clamp-3 font-display text-lg leading-snug font-semibold text-foreground">
                  <Link href={postHref(post)} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-ring">
                    {post.title}
                  </Link>
                </h3>
                <p className="type-small mt-2.5 line-clamp-3 text-muted-foreground">{post.excerpt}</p>
                <p className="type-caption mt-auto flex items-center gap-4 pt-5 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Heart strokeWidth={1.5} className="size-4" aria-hidden />
                    <span className="tabular-nums">{formatCompact(post.stats.likes)}</span>
                    <span className="sr-only">likes</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageCircle strokeWidth={1.5} className="size-4" aria-hidden />
                    <span className="tabular-nums">{formatCompact(post.stats.comments)}</span>
                    <span className="sr-only">comments</span>
                  </span>
                </p>
              </article>
            </li>
          ))}
        </ol>
      </Reveal>
    </Section>
  );
}

/* --------------------------------- Topics --------------------------------- */

export function TopicsSection({ facets }: { facets: DirectoryFacets }) {
  const topics = facets.topics.slice(0, 8);
  if (topics.length === 0) return null;

  return (
    <Section tone="navy" className="overflow-hidden">
      <SealRings className="pointer-events-none absolute -top-40 -left-56 w-[44rem] opacity-40" />
      <div className="container-wide relative">
        <Reveal>
          <SectionHeading
            eyebrow="Browse by subject"
            title="Find the ruling by the question it answers"
            description="Every summary is filed under its subject, the sections it turns on and the forum that decided it."
            action={
              <Link href="/topics" className={buttonVariants({ variant: "outline" })}>
                All {formatNumber(facets.topics.length)} topics <ArrowRight strokeWidth={1.75} />
              </Link>
            }
          />
        </Reveal>

        <Reveal className="mt-12">
          <ul className="grid overflow-hidden rounded-xl border border-white/12 sm:grid-cols-2 lg:grid-cols-4">
            {topics.map((topic) => (
              <li key={topic.slug} className="-mr-px -mb-px border-r border-b border-white/12">
                <Link
                  href={`/topics/${topic.slug}`}
                  className="group relative flex h-full min-h-40 flex-col justify-between p-6 transition-colors hover:bg-white/5"
                >
                  <span aria-hidden className="absolute inset-x-6 top-0 h-px origin-left scale-x-0 bg-gold-500 transition-transform duration-500 ease-out-expo group-hover:scale-x-100" />
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-display text-xl leading-snug font-semibold text-paper">{topic.name}</span>
                    <ArrowUpRight strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-gold-500 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                  <span className="type-caption mt-6 text-muted-foreground">
                    <span className="type-numeral mr-1.5 text-xl text-gold-400">{formatNumber(topic.count)}</span>
                    {topic.count === 1 ? "ruling" : "rulings"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}

/* -------------------------------- Insights -------------------------------- */

export function InsightsSection({ posts }: { posts: PostCard[] }) {
  if (posts.length === 0) return null;
  return (
    <Section tint>
      <div className="container-wide">
        <Reveal>
          <SectionHeading
            eyebrow="From the TaxKatha desk"
            title="Insights you can act on"
            description="What the rulings mean in practice, written by people who read the judgments."
            action={<TextLink href="/insights">All insights</TextLink>}
          />
        </Reveal>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.slice(0, 3).map((post, i) => (
            <li key={post.id}>
              <Reveal delay={0.08 * i} className="h-full">
                <InsightCard post={post} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* ------------------------- Authority and the process ----------------------- */

const steps = [
  { n: "01", title: "Search the ruling", text: "By party, section, court or subject — across every forum we cover." },
  { n: "02", title: "Read the distilled summary", text: "The point of the decision in a paragraph, then the background and reasoning." },
  { n: "03", title: "Discuss with professionals", text: "See how CAs, advocates and tax teams read the same ruling." },
  { n: "04", title: "Share the insight", text: "Send a clean, branded summary to a client or your network in one tap." },
];

export function AuthoritySection({ stats }: { stats: SiteStats }) {
  const figures = [
    { value: stats.rulings, suffix: "", label: "rulings summarised", note: "Accuracy first." },
    { value: stats.courts, suffix: "", label: "courts and tribunals covered", note: "Built around clarity." },
    { value: stats.assesseeShare, suffix: "%", label: "of decided rulings favoured the assessee", note: "Designed for confident decisions." },
  ];

  return (
    <Section>
      <div className="container-wide">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Why TaxKatha"
            title="We read the judgment so you can act on it"
            description="TaxKatha understands the complexity so you don’t have to."
          />
        </Reveal>

        <dl className="mt-16 grid gap-10 border-y py-12 sm:grid-cols-3 sm:gap-6">
          {figures.map((figure, i) => (
            <Reveal key={figure.label} delay={0.08 * i} className="text-center sm:border-l sm:first:border-l-0 sm:px-6">
              <dd className="type-numeral text-6xl leading-none text-foreground sm:text-7xl">
                <CountUp value={figure.value} suffix={figure.suffix} />
              </dd>
              <dt className="type-small mx-auto mt-4 max-w-56 text-muted-foreground">{figure.label}</dt>
              <p className="type-eyebrow mt-5 text-[0.6875rem] text-gold-text">{figure.note}</p>
            </Reveal>
          ))}
        </dl>

        <div className="mt-20">
          <Reveal>
            <h3 className="type-display-md text-center text-foreground">How it works</h3>
          </Reveal>
          <div className="relative mt-12">
            <LineReveal className="absolute top-6 right-[12.5%] left-[12.5%] hidden h-px bg-gold-500/70 lg:block" />
            <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {steps.map((step, i) => (
                <Reveal key={step.n} delay={0.1 * i}>
                  <li className="flex flex-col items-start lg:items-center lg:text-center">
                    <span className="type-numeral relative flex size-12 items-center justify-center rounded-full border border-gold-600/60 bg-background text-lg text-gold-700">
                      {step.n}
                    </span>
                    <h4 className="type-display-sm mt-5 text-foreground">{step.title}</h4>
                    <p className="type-small mt-2 max-w-64 text-muted-foreground">{step.text}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ----------------------------------- CTA ---------------------------------- */

export function CtaSection({ className }: { className?: string }) {
  return (
    <Section tone="navy" className={cn("overflow-hidden", className)}>
      <SealRings className="pointer-events-none absolute top-1/2 left-1/2 w-[56rem] -translate-x-1/2 -translate-y-1/2 opacity-35" />
      <div className="container-content relative text-center">
        <Reveal>
          <p className="type-eyebrow text-gold-500">Free for members</p>
          <h2 className="type-display-xl mx-auto mt-6 max-w-3xl text-paper">
            Your next ruling shouldn’t be <em className="text-gold-400">a surprise.</em>
          </h2>
          <p className="type-lede mx-auto mt-6 max-w-xl text-muted-foreground">
            Get clarity, confidence and control over every decision that touches your practice. Join to read the full
            analysis and the discussion.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/sign-in" className={buttonVariants({ size: "xl" })}>
              Get Started <ArrowRight strokeWidth={1.75} />
            </Link>
            <Link href="/case-laws" className={buttonVariants({ variant: "outline", size: "xl" })}>
              Explore Case Laws
            </Link>
          </div>
          <p className="type-caption mt-6 text-muted-foreground">Sign in with Google, LinkedIn or Microsoft. No card required.</p>
        </Reveal>
      </div>
    </Section>
  );
}
