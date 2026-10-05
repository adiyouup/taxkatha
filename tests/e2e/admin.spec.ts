import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { Pool } from "pg";

import { shown, signIn } from "./helpers";

/*
 * The admin suite: every change an administrator or moderator makes must
 * reach the public site at once and leave an entry in the audit log. Runs
 * after the other suites (see playwright.config.ts) and puts everything back.
 */

const ADMIN = "e2e.chief@taxkatha.test";
const MODERATOR = "e2e.moderator@taxkatha.test";
const AUTHOR = "e2e.critic@taxkatha.test";
const READER = "e2e.reader@taxkatha.test";
const STAMP = Date.now().toString(36);

type Ruling = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  topicId: string;
  topicName: string;
  topicSlug: string;
  topicDescription: string | null;
  courtId: string;
  courtName: string;
  courtSlug: string;
};

let ruling: Ruling;

// Long flows across several accounts; the dev server also compiles each admin route on first use.
test.describe.configure({ mode: "serial", timeout: 120_000 });

test.beforeAll(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    // An older ruling that no other suite relies on: not Supreme Court, not the input-tax-credit hub.
    const { rows } = await pool.query<Ruling>(`
      SELECT p.id, p.slug, p.title, p.excerpt, t.id AS "topicId", t.name AS "topicName", t.slug AS "topicSlug", t.description AS "topicDescription",
             k.id AS "courtId", k.name AS "courtName", k.slug AS "courtSlug"
      FROM posts p
      JOIN case_law_details c ON c.post_id = p.id
      JOIN courts k ON k.id = c.court_id
      JOIN topics t ON t.id = p.topic_id
      WHERE p.type = 'case_law' AND p.status = 'published' AND k.type <> 'supreme_court' AND t.reviewed
        AND t.slug <> 'input-tax-credit' AND p.boost_rank IS NULL AND k.description IS NULL
        AND p.title NOT LIKE '%"%'
      ORDER BY c.decision_date, p.slug
      LIMIT 1 OFFSET 3
    `);
    if (!rows[0]) throw new Error("No suitable ruling. Seed the database first: npm run db:seed");
    ruling = rows[0];
  } finally {
    await pool.end();
  }
});

test.afterAll(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    // The tests restore content through the admin, which also refreshes the caches. This is the
    // safety net for a test that failed half-way: the database always ends as it started.
    await pool.query(`UPDATE posts SET status = 'published', slug = $2, excerpt = $3, boost_rank = NULL, boost_until = NULL, editor_note = NULL WHERE id = $1`, [
      ruling.id,
      ruling.slug,
      ruling.excerpt,
    ]);
    await pool.query(`UPDATE topics SET description = $2 WHERE id = $1`, [ruling.topicId, ruling.topicDescription]);
    await pool.query(`UPDATE courts SET description = NULL WHERE id = $1`, [ruling.courtId]);
    await pool.query(`UPDATE site_settings SET value = jsonb_set(value, '{enabled}', 'false') WHERE key = 'announcement'`);
    await pool.query(`UPDATE site_settings SET value = '{"blockedWords": []}' WHERE key = 'community'`);
    await pool.query(`UPDATE case_law_details SET manually_edited_at = NULL WHERE post_id = $1`, [ruling.id]);
    await pool.query(`DELETE FROM slug_history WHERE post_id = $1`, [ruling.id]);
    await pool.query(`DELETE FROM comments WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY($1))`, [[AUTHOR, READER]]);
    await pool.query(`UPDATE post_stats SET comment_count = (SELECT count(*) FROM comments c WHERE c.post_id = $1 AND c.status <> 'deleted') WHERE post_id = $1`, [ruling.id]);
  } finally {
    await pool.end();
  }
});

async function asUser(browser: Browser, email: string, role: "user" | "moderator" | "admin"): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  await signIn(context, email, role);
  return { context, page: await context.newPage() };
}

async function toast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

/** Clicks a button that runs a Server Action and waits until the action has finished on the server. */
async function act(page: Page, button: Locator) {
  const response = page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined);
  await button.click();
  await (await response).finished();
}

test("each staff role sees only its part of the admin", async ({ browser, page }) => {
  // Anonymous visitors are sent to sign in.
  await page.goto("/admin/featured");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Ffeatured/);

  const member = await asUser(browser, AUTHOR, "user");
  expect((await member.page.goto("/admin/community"))?.status()).toBe(404);
  await member.context.close();

  const moderator = await asUser(browser, MODERATOR, "moderator");
  await moderator.page.goto("/admin");
  const nav = moderator.page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link", { name: "Moderation" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Case laws" })).toHaveCount(0);
  expect((await moderator.page.goto("/admin/case-laws"))?.status()).toBe(404);
  expect((await moderator.context.request.get("/admin/case-laws/export")).status()).toBe(404);
  expect((await moderator.context.request.get("/admin/users/export")).status()).toBe(404);
  expect((await moderator.page.goto("/admin/community"))?.status()).toBe(200);
  await moderator.context.close();
});

test("editing a ruling updates its public page at once and is audited", async ({ browser }) => {
  const admin = await asUser(browser, ADMIN, "admin");
  const visitor = await browser.newContext();
  const marker = `E2E-${STAMP}`;

  await admin.page.goto(`/admin/case-laws?q=${encodeURIComponent(ruling.title.slice(0, 24))}`);
  await admin.page.getByRole("link", { name: ruling.title }).first().click();
  await expect(admin.page.getByRole("heading", { level: 1 })).toContainText(ruling.title.slice(0, 20));

  const summary = admin.page.getByLabel("Case summary (public)");
  await summary.fill(`${ruling.excerpt} ${marker}`);
  const slug = admin.page.getByLabel("Web address");
  await slug.fill(`${ruling.slug}-e2e`);
  await act(admin.page, admin.page.getByRole("button", { name: "Save changes" }));
  await toast(admin.page, "Changes saved.");

  // Visitors see the new text, and the old address redirects to the new one.
  const page = await visitor.newPage();
  await page.goto(`/case-laws/${ruling.slug}`);
  await expect(page).toHaveURL(new RegExp(`/case-laws/${ruling.slug}-e2e$`));
  await expect(shown(page, marker)).toBeVisible();

  // Put it back.
  await summary.fill(ruling.excerpt);
  await slug.fill(ruling.slug);
  await act(admin.page, admin.page.getByRole("button", { name: "Save changes" }));
  await toast(admin.page, "Changes saved.");
  await page.goto(`/case-laws/${ruling.slug}`);
  await expect(page).toHaveURL(new RegExp(`/case-laws/${ruling.slug}$`));
  await expect(page.getByText(marker)).toHaveCount(0);

  await admin.page.goto("/admin/audit?area=case");
  await expect(admin.page.getByRole("link", { name: new RegExp(`Edited “${ruling.title.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first()).toBeVisible();
  await admin.context.close();
  await visitor.close();
});

test("bulk actions take a ruling off the site and bring it back", async ({ browser }) => {
  const admin = await asUser(browser, ADMIN, "admin");
  const visitor = await (await browser.newContext()).newPage();
  // A missing post is a "soft" 404: the page has streamed with 200 by the time the post is looked up,
  // so it shows the not-found page and tells search engines not to index it.
  const gone = async () => {
    await visitor.goto(`/case-laws/${ruling.slug}`);
    await expect(shown(visitor, "not on the record")).toBeVisible();
    await expect(visitor.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  };

  await admin.page.goto(`/admin/case-laws?q=${encodeURIComponent(ruling.title.slice(0, 24))}`);
  await admin.page.getByRole("checkbox", { name: `Select ${ruling.title}` }).check();
  await act(admin.page, admin.page.getByRole("button", { name: "Unpublish", exact: true }));
  await toast(admin.page, "1 ruling moved to drafts.");
  await gone();

  await admin.page.goto(`/admin/case-laws?status=draft&q=${encodeURIComponent(ruling.title.slice(0, 24))}`);
  await admin.page.getByRole("checkbox", { name: `Select ${ruling.title}` }).check();
  await act(admin.page, admin.page.getByRole("button", { name: "Publish", exact: true }));
  await toast(admin.page, "1 ruling published.");
  await visitor.goto(`/case-laws/${ruling.slug}`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(ruling.title);

  await admin.context.close();
  await visitor.context().close();
});

test("featuring a ruling puts it on the home page with the editor's note", async ({ browser }) => {
  const admin = await asUser(browser, ADMIN, "admin");
  const visitor = await browser.newContext();
  const note = `Why now ${STAMP}`;

  await admin.page.goto("/admin/featured");
  await admin.page.getByLabel("Find a post to feature").fill(`/case-laws/${ruling.slug}`);
  await act(admin.page, admin.page.getByRole("button", { name: ruling.title }).first());
  await toast(admin.page, `Featured: ${ruling.title}`);

  await admin.page.getByLabel(/Editor.s note/).fill(note);
  await act(admin.page, admin.page.getByRole("button", { name: "Save", exact: true }));
  await toast(admin.page, "Saved.");

  const home = await visitor.newPage();
  await home.goto("/");
  await expect(home.getByRole("heading", { name: "Rulings worth your attention" })).toBeVisible();
  await expect(home.getByRole("link", { name: ruling.title }).first()).toBeVisible();
  await expect(shown(home, note)).toBeVisible();

  await act(admin.page, admin.page.getByRole("button", { name: `Stop featuring “${ruling.title}”` }));
  await toast(admin.page, "Removed from featured.");
  await home.goto("/");
  await expect(home.getByText(note)).toHaveCount(0);

  await admin.context.close();
  await visitor.close();
});

test("topic and court descriptions reach their public pages", async ({ browser }) => {
  const admin = await asUser(browser, ADMIN, "admin");
  const visitor = await (await browser.newContext()).newPage();
  const topicText = `Every ruling on this subject, E2E ${STAMP}.`;
  const courtText = `Introduction for this court, E2E ${STAMP}.`;

  await admin.page.goto("/admin/taxonomy");
  await admin.page.getByRole("button", { name: `Edit ${ruling.topicName}`, exact: true }).click();
  const topicDialog = admin.page.getByRole("dialog", { name: "Edit topic" });
  await topicDialog.getByLabel("Description").fill(topicText);
  await act(admin.page, topicDialog.getByRole("button", { name: "Save topic" }));
  await toast(admin.page, "Topic saved.");
  await visitor.goto(`/topics/${ruling.topicSlug}`);
  await expect(shown(visitor, topicText)).toBeVisible();

  await admin.page.getByRole("button", { name: `Edit ${ruling.topicName}`, exact: true }).click();
  await topicDialog.getByLabel("Description").fill(ruling.topicDescription ?? "");
  await act(admin.page, topicDialog.getByRole("button", { name: "Save topic" }));
  await toast(admin.page, "Topic saved.");

  await admin.page.goto("/admin/taxonomy?tab=courts");
  await admin.page.getByRole("button", { name: `Edit ${ruling.courtName}`, exact: true }).click();
  const courtDialog = admin.page.getByRole("dialog", { name: "Edit court" });
  await courtDialog.getByLabel("Introduction").fill(courtText);
  await act(admin.page, courtDialog.getByRole("button", { name: "Save court" }));
  await toast(admin.page, "Court saved.");
  await visitor.goto(`/courts/${ruling.courtSlug}`);
  await expect(shown(visitor, courtText)).toBeVisible();

  await admin.page.getByRole("button", { name: `Edit ${ruling.courtName}`, exact: true }).click();
  await courtDialog.getByLabel("Introduction").fill("");
  await act(admin.page, courtDialog.getByRole("button", { name: "Save court" }));
  await toast(admin.page, "Court saved.");
  await visitor.goto(`/courts/${ruling.courtSlug}`);
  await expect(visitor.getByText(courtText)).toHaveCount(0);

  await admin.context.close();
  await visitor.context().close();
});

test("a reported comment is hidden by a moderator and members see a placeholder", async ({ browser }) => {
  const text = `This reading of the law is plainly wrong, E2E ${STAMP}`;

  const author = await asUser(browser, AUTHOR, "user");
  await author.page.goto(`/case-laws/${ruling.slug}#discussion`);
  const discussion = author.page.locator("#discussion");
  await discussion.getByRole("textbox", { name: "Add to the discussion" }).fill(text);
  await act(author.page, discussion.getByRole("button", { name: "Post", exact: true }));
  await expect(discussion.getByRole("article").filter({ hasText: text })).toBeVisible();

  const reader = await asUser(browser, READER, "user");
  await reader.page.goto(`/case-laws/${ruling.slug}#discussion`);
  const comment = reader.page.locator("#discussion").getByRole("article").filter({ hasText: text });
  await comment.getByRole("button", { name: "More options" }).click();
  await reader.page.getByRole("menuitem", { name: "Report" }).click();
  const report = reader.page.getByRole("dialog", { name: "Report this comment" });
  await report.getByLabel("Spam or promotion").check();
  await act(reader.page, report.getByRole("button", { name: "Send report" }));
  await toast(reader.page, "A moderator will review this comment.");

  const moderator = await asUser(browser, MODERATOR, "moderator");
  await moderator.page.goto("/admin/community");
  const item = moderator.page.getByRole("listitem").filter({ hasText: text });
  await expect(item).toContainText("1 open report");
  await act(moderator.page, item.getByRole("button", { name: "Hide" }));
  await toast(moderator.page, "Comment hidden.");
  await expect(moderator.page.getByRole("heading", { name: "Nothing to review" })).toBeVisible();

  await reader.page.reload();
  await expect(shown(reader.page.locator("#discussion"), "This comment was hidden by a moderator.")).toBeVisible();
  await expect(reader.page.locator("#discussion").getByText(text)).toHaveCount(0);

  // The author is told, and can still see what they wrote.
  await author.page.reload();
  await expect(shown(author.page.locator("#discussion"), "This comment was hidden by a moderator.")).toBeVisible();
  await expect(shown(author.page.locator("#discussion"), text)).toBeVisible();

  await moderator.page.goto("/admin/community?tab=comments&status=hidden");
  await expect(moderator.page.getByRole("listitem").filter({ hasText: text })).toBeVisible();

  for (const user of [author, reader, moderator]) await user.context.close();
});

test("settings go live at once: announcement bar and blocked words", async ({ browser }) => {
  const admin = await asUser(browser, ADMIN, "admin");
  const visitor = await (await browser.newContext()).newPage();
  const message = `E2E announcement ${STAMP}`;

  await admin.page.goto("/admin/settings");
  const announcement = admin.page.locator("section").filter({ has: admin.page.getByRole("heading", { name: "Announcement bar" }) });
  await announcement.getByLabel("Show the announcement bar").check();
  await announcement.getByLabel("Message").fill(message);
  await announcement.getByLabel("Link text").fill("Read the insights");
  await announcement.getByLabel("Link", { exact: true }).fill("/insights");
  await act(admin.page, announcement.getByRole("button", { name: "Save" }));
  await toast(admin.page, "Saved.");

  await visitor.goto("/case-laws");
  const bar = visitor.getByRole("complementary", { name: "Announcement" });
  await expect(bar).toContainText(message);
  await expect(bar.getByRole("link", { name: "Read the insights" })).toHaveAttribute("href", "/insights");

  // A blocked word stops a comment.
  const community = admin.page.locator("section").filter({ has: admin.page.getByRole("heading", { name: "Community" }) });
  await community.getByLabel("Blocked words and phrases").fill(`zqx${STAMP}`);
  await act(admin.page, community.getByRole("button", { name: "Save" }));
  await toast(admin.page, "Saved.");

  const author = await asUser(browser, AUTHOR, "user");
  await author.page.goto(`/case-laws/${ruling.slug}#discussion`);
  const discussion = author.page.locator("#discussion");
  await discussion.getByRole("textbox", { name: "Add to the discussion" }).fill(`What about zqx${STAMP} here?`);
  await act(author.page, discussion.getByRole("button", { name: "Post", exact: true }));
  await toast(author.page, "includes a word that is not allowed");
  await author.context.close();

  // Put both back.
  await community.getByLabel("Blocked words and phrases").fill("");
  await act(admin.page, community.getByRole("button", { name: "Save" }));
  await toast(admin.page, "Saved.");
  await announcement.getByLabel("Show the announcement bar").uncheck();
  await announcement.getByLabel("Message").fill("");
  await announcement.getByLabel("Link text").fill("");
  await announcement.getByLabel("Link", { exact: true }).fill("");
  await act(admin.page, announcement.getByRole("button", { name: "Save" }));
  await toast(admin.page, "Saved.");
  await visitor.goto("/case-laws");
  await expect(visitor.getByRole("complementary", { name: "Announcement" })).toHaveCount(0);

  await admin.context.close();
  await visitor.context().close();
});

test("a ban signs the member out everywhere, and is audited", async ({ browser }) => {
  const author = await asUser(browser, AUTHOR, "user");
  await author.page.goto(`/case-laws/${ruling.slug}#discussion`);
  await expect(author.page.locator("#discussion").getByRole("textbox", { name: "Add to the discussion" })).toBeVisible();

  const admin = await asUser(browser, ADMIN, "admin");
  await admin.page.goto(`/admin/users?q=${encodeURIComponent(AUTHOR)}`);
  await admin.page.getByRole("link", { name: /e2e\.critic@taxkatha\.test/ }).click();
  await admin.page.getByRole("button", { name: "Ban member" }).click();
  const dialog = admin.page.getByRole("dialog", { name: /^Ban / });
  await dialog.getByLabel("For how long").selectOption("1");
  await dialog.getByLabel("Reason").fill(`Spam links, E2E ${STAMP}`);
  await act(admin.page, dialog.getByRole("button", { name: "Ban member" }));
  await toast(admin.page, "is banned.");
  await expect(admin.page.getByText("Banned", { exact: true }).first()).toBeVisible();

  // Their sessions are gone: whatever page they still have open, the server refuses their next post.
  const discussion = author.page.locator("#discussion");
  await discussion.getByRole("textbox", { name: "Add to the discussion" }).fill(`One more thing, E2E ${STAMP}`);
  await act(author.page, discussion.getByRole("button", { name: "Post", exact: true }));
  await toast(author.page, "Sign in to join the discussion.");
  await expect(discussion.getByText(`One more thing, E2E ${STAMP}`)).toHaveCount(1);

  await act(admin.page, admin.page.getByRole("button", { name: "Lift ban" }));
  await toast(admin.page, "Ban lifted.");

  await admin.page.goto("/admin/audit?area=user");
  await expect(admin.page.getByText(`Spam links, E2E ${STAMP}`)).toBeVisible();
  await expect(admin.page.getByText(/Lifted the ban on/).first()).toBeVisible();

  await author.context.close();
  await admin.context.close();
});

test("exports: a re-importable workbook and the opted-in email list", async ({ browser }) => {
  const admin = await asUser(browser, ADMIN, "admin");
  const workbook = await admin.context.request.get(`/admin/case-laws/export?q=${encodeURIComponent(ruling.title.slice(0, 24))}`);
  expect(workbook.status()).toBe(200);
  expect(workbook.headers()["content-type"]).toContain("spreadsheetml");
  expect((await workbook.body()).subarray(0, 2).toString()).toBe("PK");

  const csv = await admin.context.request.get("/admin/users/export");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect((await csv.text()).split("\r\n")[0]).toContain('"Name","Email","Profession"');
  await admin.context.close();
});
