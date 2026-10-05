import { Suspense } from "react";

import { PostActions } from "@/components/engagement/post-actions";
import type { ShareTarget } from "@/components/engagement/share-sheet";
import { getLivePostStats } from "@/server/queries/posts";

async function Live({ target, className }: { target: ShareTarget; className?: string }) {
  const stats = await getLivePostStats(target.id);
  return <PostActions variant="bar" className={className} target={target} counts={{ likes: stats.likes, comments: stats.comments }} />;
}

/**
 * The like / comment / save / share bar on a post page. The page is cached
 * until the post is edited, so it shows the counts it was cached with and
 * replaces them with live ones as the request streams (the page already
 * streams its members-only part on every request, so this costs one small
 * query, not an extra render).
 */
export function LivePostActions({ target, cached, className }: { target: ShareTarget; cached: { likes: number; comments: number }; className?: string }) {
  return (
    <Suspense fallback={<PostActions variant="bar" className={className} target={target} counts={cached} />}>
      <Live target={target} className={className} />
    </Suspense>
  );
}
