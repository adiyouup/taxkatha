import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/*
 * Optimistic check only: bounces visitors without a session cookie away from
 * member-only areas. It does NOT authorize anything — every page, Server
 * Action and Route Handler verifies the session through the DAL.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request, { cookiePrefix: "taxkatha" })) return NextResponse.next();

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/admin/:path*", "/saved", "/settings/:path*", "/notifications", "/welcome"],
};
