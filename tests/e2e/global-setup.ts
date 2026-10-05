import { request, type FullConfig } from "@playwright/test";

import { gatedSample } from "./helpers";

/*
 * `next dev` compiles each route the first time it is requested. When several
 * workers trigger those first compiles at once the server can answer with a
 * transient error, so visit every route the suite uses once, one at a time.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const sample = await gatedSample();
  const context = await request.newContext({ baseURL });

  const login = await context.post("/api/dev/login", {
    form: { email: "e2e.warmup@taxkatha.test", role: "admin", next: "/" },
    headers: { Origin: new URL(baseURL).origin },
    maxRedirects: 0,
  });
  if (login.status() !== 303) throw new Error(`Dev login failed (${login.status()}). Start the dev server with DEV_LOGIN=true.`);

  // A missing id still compiles the route; the response status does not matter here.
  const none = "00000000-0000-4000-8000-000000000000";
  const routes = [
    "/",
    "/case-laws",
    "/case-laws?page=2",
    `/case-laws/${sample.slug}`,
    `/case-laws/${sample.slug}/thread/${none}`,
    `/case-laws/${sample.slug}/opengraph-image`,
    "/topics",
    "/topics/input-tax-credit",
    "/courts",
    "/courts/supreme-court-of-india",
    "/insights",
    "/insights/warm-up",
    `/insights/warm-up/thread/${none}`,
    "/sign-in",
    "/welcome",
    "/auth/error",
    "/saved",
    "/notifications",
    "/settings",
    "/admin",
    "/admin/import",
    `/admin/import/${none}`,
    "/admin/insights",
    "/admin/insights/new",
    `/admin/insights/${none}`,
    "/admin/case-laws",
    "/admin/case-laws/new",
    `/admin/case-laws/${none}`,
    "/admin/featured",
    "/admin/taxonomy",
    "/admin/community",
    "/admin/users",
    "/admin/users/warm-up",
    "/admin/marketing",
    "/admin/settings",
    "/admin/audit",
    "/api/auth/get-session",
    "/api/viewer/state?ids=",
    `/api/comments?post=${none}`,
    "/api/admin/posts/search?q=warm",
    "/uploads/insights/warm-up.png",
    `/api/cards/${sample.slug}/square`,
    "/sitemap.xml",
    "/this-page-does-not-exist",
  ];
  for (const route of routes) {
    await context.get(route, { failOnStatusCode: false, timeout: 120_000 });
  }
  // POST-only handlers compile on their first call too.
  for (const route of ["/api/track/view", "/api/admin/upload"]) {
    await context.post(route, { data: {}, failOnStatusCode: false, timeout: 120_000 });
  }
  await context.dispose();
}
