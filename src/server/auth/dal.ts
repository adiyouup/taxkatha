import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { auth } from "./auth";
import { highestRole, type Role } from "./permissions";

/*
 * Data Access Layer for identity. Every Server Action, Route Handler and
 * gated component goes through here — layouts and the proxy are never
 * trusted for authorization.
 *
 * These read request headers, so under Cache Components they must be called
 * inside a <Suspense> boundary (never at the top of a layout).
 */

export type Viewer = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  profession: string | null;
  headline: string | null;
  onboarded: boolean;
};

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

function toViewer(result: SessionResult): Viewer | null {
  if (!result) return null;
  const u = result.user;
  if (u.banned) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    role: highestRole(u.role),
    profession: u.profession ?? null,
    headline: u.headline ?? null,
    onboarded: Boolean(u.onboardedAt),
  };
}

/**
 * A session belongs to a live request: validating it compares its expiry with
 * the current time. `connection()` keeps the read (and everything rendered
 * from it) out of prerenders and prefetches, so member-only output is only
 * ever produced for the request that asked for it.
 *
 * `disableRefresh` makes this a pure read. Without it Better Auth rewrites the
 * session cookies, and a cookie written inside a Server Action makes Next.js
 * re-render the whole page before the action returns — every like or comment
 * would pay for it, and the next action would queue behind it. The browser
 * keeps the cookies fresh through /api/auth/get-session instead.
 */
async function readSession(fresh: boolean): Promise<SessionResult> {
  await connection();
  return auth.api.getSession({ headers: await headers(), query: { disableRefresh: true, disableCookieCache: fresh } });
}

/**
 * The signed-in member, read from the signed cookie cache (at most five
 * minutes stale). Use for rendering and for reads.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => toViewer(await readSession(false)));

/**
 * The signed-in member straight from the database. Use before privileged or
 * abuse-sensitive writes so role changes and bans apply immediately.
 */
export const getFreshViewer = cache(async (): Promise<Viewer | null> => toViewer(await readSession(true)));

/** For pages: redirects anonymous visitors to sign-in, then back to `next`. */
export async function requireViewer(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return viewer;
}

const RANK: Record<Role, number> = { user: 0, moderator: 1, admin: 2 };

export function hasRole(viewer: Viewer | null, minimum: Role): viewer is Viewer {
  return viewer !== null && RANK[viewer.role] >= RANK[minimum];
}

/**
 * For admin pages: anonymous → sign-in; signed in without the role → 404
 * (the admin area's existence is not advertised).
 */
export async function requireRolePage(minimum: Exclude<Role, "user">, next = "/admin"): Promise<Viewer> {
  const viewer = await getFreshViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (!hasRole(viewer, minimum)) notFound();
  return viewer;
}

export class AuthError extends Error {
  constructor(public readonly code: "unauthenticated" | "forbidden") {
    super(code);
    this.name = "AuthError";
  }
}

/** For Server Actions and Route Handlers: throws AuthError instead of redirecting. */
export async function authorize(minimum: Role = "user"): Promise<Viewer> {
  const viewer = await getFreshViewer();
  if (!viewer) throw new AuthError("unauthenticated");
  if (!hasRole(viewer, minimum)) throw new AuthError("forbidden");
  return viewer;
}
