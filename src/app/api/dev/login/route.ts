import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/safe-redirect";
import { isRole } from "@/server/auth/permissions";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

/*
 * DEVELOPMENT ONLY. Signs in as any email without an OAuth app so the site
 * can be built and tested locally. Hard-disabled in production builds, and
 * off unless DEV_LOGIN=true.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || process.env.DEV_LOGIN !== "true") {
    return new NextResponse("Not found", { status: 404 });
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const roleInput = form.get("role");
  const role = isRole(roleInput) ? roleInput : "user";
  const next = safeNextPath(form.get("next"), "/");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  let userId = existing?.id;
  if (!existing) {
    userId = crypto.randomUUID();
    const local = email.split("@")[0] ?? "member";
    await db.insert(user).values({
      id: userId,
      email,
      name: local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      emailVerified: true,
      role,
    });
  } else if (existing.role !== role) {
    await db.update(user).set({ role }).where(eq(user.id, existing.id));
  }

  const { devAuth } = await import("@/server/auth/dev-auth");
  const ctx = await devAuth.$context;
  const cookies = await ctx.test.getCookies({ userId: userId!, domain: new URL(request.url).hostname });

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  for (const c of cookies) {
    response.cookies.set(c.name, c.value, {
      path: c.path,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite?.toLowerCase() as "lax" | "strict" | "none" | undefined,
      expires: c.expires ? new Date(c.expires * 1000) : undefined,
    });
  }
  return response;
}
