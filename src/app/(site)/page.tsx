import { Hero, type HeroCard } from "@/components/marketing/hero";
import { AuthoritySection, CtaSection, FeaturedSection, InsightsSection, TopicsSection, TrendingSection } from "@/components/marketing/sections";
import { siteConfig } from "@/lib/site";
import {
  getDirectoryFacets,
  getFeaturedPosts,
  getLatestPosts,
  getSiteStats,
  getTrendingPosts,
  searchPosts,
  type PostCard,
} from "@/server/queries/posts";
import { getSiteSettings } from "@/server/settings";

function heroCard(post: PostCard | undefined): HeroCard | null {
  if (!post?.caseLaw) return null;
  return {
    slug: post.slug,
    title: post.title,
    court: post.caseLaw.court.shortName,
    decisionDate: post.caseLaw.decisionDate,
    outcomeSide: post.caseLaw.outcomeSide,
    remanded: post.caseLaw.remanded,
  };
}

const jsonLd = (sameAs: string[]) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: `${siteConfig.url}/brand/taxkatha-logo.png`,
      slogan: siteConfig.tagline,
      sameAs,
    },
    {
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${siteConfig.url}/case-laws?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ],
});

/** Every section reads from cached queries, so the whole page is prerendered and refreshes on its own. */
export default async function HomePage() {
  const [settings, stats, boosted, trending, facets, forAssessee, forRevenue, supremeCourt, insights] = await Promise.all([
    getSiteSettings(),
    getSiteStats(),
    getFeaturedPosts(3),
    getTrendingPosts(8),
    getDirectoryFacets(),
    searchPosts({ type: "case_law", outcome: "assessee", forum: "high_court" }, { page: 1, member: false, pageSize: 1 }),
    searchPosts({ type: "case_law", outcome: "revenue", forum: "high_court" }, { page: 1, member: false, pageSize: 1 }),
    searchPosts({ type: "case_law", forum: "supreme_court" }, { page: 1, member: false, pageSize: 3 }),
    getLatestPosts("insight", 3),
  ]);

  const hasBoosted = boosted.length > 0;
  // Fewer than three featured posts: the latest Supreme Court rulings fill the remaining places.
  const boostedIds = new Set(boosted.map((post) => post.id));
  const featured = [...boosted, ...supremeCourt.items.filter((post) => !boostedIds.has(post.id))].slice(0, 3);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(Object.values(settings.social).filter(Boolean))).replace(/</g, "\\u003c") }}
      />
      <Hero
        copy={settings.hero}
        stats={{ rulings: stats.rulings, courts: stats.courts, assesseeShare: stats.assesseeShare, latestDecision: stats.latestDecision }}
        pair={{ assessee: heroCard(forAssessee.items[0]), revenue: heroCard(forRevenue.items[0]) }}
      />
      <FeaturedSection posts={featured} boosted={hasBoosted} />
      <TrendingSection trending={trending} />
      <TopicsSection facets={facets} />
      <AuthoritySection stats={stats} />
      <InsightsSection posts={insights} />
      <CtaSection />
    </>
  );
}
