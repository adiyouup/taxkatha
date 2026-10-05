import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SignInGate } from "@/components/auth/sign-in-gate";
import { Discussion } from "@/components/comments/discussion";
import { Section } from "@/components/layout/section";
import { getViewer } from "@/server/auth/dal";
import { getThread } from "@/server/comments";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Open thread": one top-level comment with all of its replies, on its own
 * page. Shared by case laws and insights. Members only.
 */
export async function ThreadView({
  post,
  commentId,
}: {
  post: { id: string; title: string; path: string; eyebrow: string; backLabel: string };
  commentId: string;
}) {
  if (!UUID.test(commentId)) notFound();

  const header = (
    <header className="theme-navy grain">
      <div className="container-wide pt-28 pb-10 sm:pt-32">
        <Link href={`${post.path}#discussion`} className="type-small inline-flex items-center gap-2 font-semibold text-gold-400 hover:underline">
          <ArrowLeft className="size-4" /> {post.backLabel}
        </Link>
        <p className="type-eyebrow mt-7 text-gold-500">{post.eyebrow}</p>
        <h1 className="type-display-md mt-4 max-w-3xl text-paper">{post.title}</h1>
      </div>
      <div className="h-px bg-linear-to-r from-transparent via-gold-500/50 to-transparent" />
    </header>
  );

  const viewer = await getViewer();
  if (!viewer) {
    return (
      <>
        {header}
        <Section className="py-12">
          <div className="container-wide max-w-3xl">
            <SignInGate
              next={`${post.path}/thread/${commentId}`}
              title="Join the discussion"
              description="See how professionals read this, and add your own view. The discussion is free for members."
              sections={["Discussion"]}
            />
          </div>
        </Section>
      </>
    );
  }

  const thread = await getThread(commentId, viewer);
  if (!thread || thread.root.postId !== post.id) notFound();

  return (
    <>
      {header}
      <Section className="py-12">
        <div className="container-wide max-w-3xl">
          <Discussion
            single
            postId={post.id}
            postPath={post.path}
            me={{ id: viewer.id, name: viewer.name, image: viewer.image }}
            initial={[{ ...thread.root, replies: thread.replies }]}
            initialHasMore={false}
          />
        </div>
      </Section>
    </>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="theme-navy" aria-hidden>
      <div className="container-wide space-y-5 pt-28 pb-12 sm:pt-32">
        <div className="h-4 w-40 animate-pulse rounded-sm bg-white/10" />
        <div className="h-10 w-2/3 animate-pulse rounded-sm bg-white/10" />
      </div>
    </div>
  );
}
