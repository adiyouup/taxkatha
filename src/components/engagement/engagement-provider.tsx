"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { OAuthButtons, type ProviderId } from "@/components/auth/oauth-buttons";
import { GoldRule } from "@/components/brand/motif";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/*
 * Per-viewer engagement state for whatever posts are on screen. Lists and
 * pages are served from the shared cache; this provider fetches the small
 * personal layer (which posts I liked or saved, my unread notifications)
 * and opens the sign-in prompt when an anonymous visitor tries to interact.
 */

type Engagement = {
  /** null while the session is still loading. */
  signedIn: boolean | null;
  userId: string | null;
  unread: number;
  isLiked: (postId: string) => boolean;
  isSaved: (postId: string) => boolean;
  markLiked: (postId: string, liked: boolean) => void;
  markSaved: (postId: string, saved: boolean) => void;
  /** Ask for this post's state to be loaded. */
  track: (postId: string) => void;
  /** Opens the sign-in dialog; `reason` finishes the sentence "Sign in to …". */
  promptSignIn: (reason: string) => void;
  clearUnread: () => void;
};

const EngagementContext = createContext<Engagement | null>(null);

export function useEngagement(): Engagement {
  const value = useContext(EngagementContext);
  if (!value) throw new Error("useEngagement must be used inside <EngagementProvider>");
  return value;
}

type StateResponse = { signedIn: boolean; liked: string[]; saved: string[]; unread: number };

export function EngagementProvider({ providers, children }: { providers: ProviderId[]; children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id ?? null;

  const [liked, setLiked] = useState<ReadonlySet<string>>(new Set());
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const [unread, setUnread] = useState(0);
  const [prompt, setPrompt] = useState<string | null>(null);

  const known = useRef(new Set<string>());
  const queue = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef<string | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    if (!userRef.current) return;
    const ids = [...queue.current];
    queue.current.clear();
    try {
      const response = await fetch(`/api/viewer/state?ids=${ids.join(",")}`, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as StateResponse;
      if (!data.signedIn) return;
      setLiked((current) => new Set([...current, ...data.liked]));
      setSaved((current) => new Set([...current, ...data.saved]));
      setUnread(data.unread);
    } catch {
      // Personal state is an enhancement; the page works without it.
    }
  }, []);

  const schedule = useCallback(() => {
    if (timer.current === null) timer.current = setTimeout(flush, 40);
  }, [flush]);

  const track = useCallback(
    (postId: string) => {
      if (known.current.has(postId)) return;
      known.current.add(postId);
      queue.current.add(postId);
      if (userRef.current) schedule();
    },
    [schedule],
  );

  // A different member (or nobody) is now signed in: drop the previous member's state.
  // While the session is still loading the owner is unknown (undefined), and learning
  // who it is must not discard what the member already tapped in the meantime.
  const identity = isPending ? undefined : userId;
  const [owner, setOwner] = useState(identity);
  if (identity !== undefined && owner !== identity) {
    setOwner(identity);
    if (owner !== undefined) {
      setLiked(new Set());
      setSaved(new Set());
      setUnread(0);
    }
  }

  // On sign-in (or when the session first resolves) load state for everything on screen.
  useEffect(() => {
    userRef.current = userId;
    if (!userId) return;
    for (const id of known.current) queue.current.add(id);
    schedule();
  }, [userId, schedule]);

  const clearUnread = useCallback(() => setUnread(0), []);
  const promptSignIn = useCallback((reason: string) => setPrompt(reason), []);

  const value = useMemo<Engagement>(
    () => ({
      signedIn: isPending ? null : userId !== null,
      userId,
      unread,
      isLiked: (id) => liked.has(id),
      isSaved: (id) => saved.has(id),
      markLiked: (id, on) =>
        setLiked((current) => {
          const next = new Set(current);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        }),
      markSaved: (id, on) =>
        setSaved((current) => {
          const next = new Set(current);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        }),
      track,
      promptSignIn,
      clearUnread,
    }),
    [isPending, userId, unread, liked, saved, track, promptSignIn, clearUnread],
  );

  const next = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;

  return (
    <EngagementContext.Provider value={value}>
      {children}
      <Dialog open={prompt !== null} onOpenChange={(open) => !open && setPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <p className="type-eyebrow text-[0.6875rem] text-gold-text">Members</p>
            <DialogTitle className="type-display-sm">Sign in to {prompt ?? "continue"}</DialogTitle>
            <GoldRule align="start" className="mt-1" />
            <DialogDescription className="type-small pt-1 text-muted-foreground">
              Membership is free. You also get the full analysis of every ruling and the professional discussion.
            </DialogDescription>
          </DialogHeader>
          {providers.length > 0 ? (
            <OAuthButtons providers={providers} next={next} />
          ) : (
            <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className={buttonVariants({ size: "lg", className: "w-full" })}>
              Sign in to continue
            </Link>
          )}
        </DialogContent>
      </Dialog>
    </EngagementContext.Provider>
  );
}
