import type { APIRequestContext, BrowserContext, Locator, Page } from "@playwright/test";
import { Pool } from "pg";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // optional
  }
}

/** Signs the browser context in through the development-only login route. */
export async function signIn(context: BrowserContext, email: string, role: "user" | "moderator" | "admin" = "user") {
  const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000").origin;
  const response = await context.request.post("/api/dev/login", {
    form: { email, role, next: "/" },
    headers: { Origin: origin },
    maxRedirects: 0,
  });
  if (response.status() !== 303) {
    throw new Error(`Dev login failed (${response.status()}). Start the dev server with DEV_LOGIN=true.`);
  }
}

export type GatedSample = { slug: string; title: string; background: string; decision: string; headnote: string };

/** A published case plus phrases that exist ONLY in its gated text. */
export async function gatedSample(): Promise<GatedSample> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const { rows } = await pool.query<{ slug: string; title: string; background: string; decision: string; excerpt: string }>(`
      select p.slug, p.title, c.background, c.decision, p.excerpt
      from posts p join case_law_details c on c.post_id = p.id
      where p.status = 'published' and length(c.background) > 300 and length(c.decision) > 300
      order by c.decision_date desc, p.slug
      limit 40
    `);
    for (const row of rows) {
      // A single clause (no " - " inside), long enough to be unique, absent from every public field.
      const pick = (text: string) =>
        text
          .split(/\s+-\s+/)
          .map((part) => part.trim())
          .find((part) => part.length > 45 && part.length < 160 && !/[<>&"']/.test(part) && !row.excerpt.includes(part) && !row.title.includes(part));
      const background = pick(row.background);
      const decision = pick(row.decision);
      if (background && decision) {
        return { slug: row.slug, title: row.title, background, decision, headnote: row.excerpt.slice(0, 60) };
      }
    }
    throw new Error("No suitable case found. Seed the database first: npm run db:seed");
  } finally {
    await pool.end();
  }
}

/** Fetches the React Server Components payload the client router would request. */
export async function fetchRsc(request: APIRequestContext, path: string) {
  const response = await request.get(path, { headers: { RSC: "1" } });
  return { status: response.status(), body: await response.text() };
}

/**
 * Text that is actually on screen. React streams late content into a hidden
 * holder and then moves it into place, so for an instant a plain text query can
 * match two copies of the same words.
 */
export function shown(scope: Page | Locator, text: string | RegExp, options?: { exact?: boolean }): Locator {
  return scope.getByText(text, options).filter({ visible: true });
}

/**
 * `page.goto` that tolerates one aborted navigation. Under parallel load the
 * dev server occasionally hands the browser a navigation it cancels
 * (net::ERR_ABORTED); a second attempt is a fair retry, not a hidden failure.
 */
export async function gotoSettled(page: Page, url: string) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  try {
    return await page.goto(url);
  } catch (error) {
    if (!String(error).includes("ERR_ABORTED")) throw error;
    return page.goto(url);
  }
}
