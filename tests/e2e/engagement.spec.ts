import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { gatedSample, gotoSettled, shown, signIn, type GatedSample } from "./helpers";

/*
 * Likes, saves, comments, threads, notifications and sharing — the
 * "Instagram-like" layer. These tests write to the local database with
 * dedicated e2e accounts and clean up after themselves.
 */
const ALICE = "e2e.alice@taxkatha.test";
const BOB = "e2e.bob@taxkatha.test";

let sample: GatedSample;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  sample = await gatedSample();
});

test.afterAll(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    // Remove the test discussion outright (deleting a user only erases their comments).
    await pool.query(`DELETE FROM comments WHERE user_id IN (SELECT id FROM "user" WHERE email IN ($1, $2))`, [ALICE, BOB]);
    await pool.query(`DELETE FROM "user" WHERE email IN ($1, $2)`, [ALICE, BOB]);
    await pool.query(`DELETE FROM share_events WHERE post_id = (SELECT id FROM posts WHERE slug = $1)`, [sample.slug]);
    await pool.query(`DELETE FROM post_views_daily WHERE post_id = (SELECT id FROM posts WHERE slug = $1)`, [sample.slug]);
    await pool.query(`DELETE FROM view_dedupe WHERE post_id = (SELECT id FROM posts WHERE slug = $1)`, [sample.slug]);
    await pool.query(`
      UPDATE post_stats s SET
        like_count = (SELECT count(*) FROM post_likes l WHERE l.post_id = s.post_id),
        save_count = (SELECT count(*) FROM post_saves v WHERE v.post_id = s.post_id),
        comment_count = (SELECT count(*) FROM comments c WHERE c.post_id = s.post_id AND c.status <> 'deleted'),
        share_count = 0, view_count = (SELECT coalesce(sum(views), 0) FROM post_views_daily d WHERE d.post_id = s.post_id)
      WHERE s.post_id = (SELECT id FROM posts WHERE slug = $1)`, [sample.slug]);
  } finally {
    await pool.end();
  }
});

const casePath = () => `/case-laws/${sample.slug}`;
const header = (page: Page) => page.locator("article > header");

test("anonymous visitors are asked to sign in before liking", async ({ page }) => {
  await page.goto(casePath());
  await header(page).getByRole("button", { name: "Like", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Sign in to like this ruling" })).toBeVisible();
});

test("a member can like and save a ruling, and it persists", async ({ page, context }) => {
  await signIn(context, ALICE);
  await page.goto(casePath());

  const like = header(page).getByRole("button", { name: /^(Like|Unlike)$/ });
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toContainText("1");

  // Tapped while the like is still on its way: both must stick.
  await header(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(header(page).getByRole("button", { name: "Remove from saved" })).toBeVisible();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  // The toast is the server's confirmation; only then is it safe to leave the page.
  await expect(page.getByText("Saved. Find it under Saved in your account menu.")).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(header(page).getByRole("button", { name: "Unlike" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: sample.title })).toBeVisible();
});

test("members discuss in threads: comment, reply, like, edit", async ({ page, context, browser }) => {
  await signIn(context, ALICE);
  await page.goto(`${casePath()}#discussion`);

  const discussion = page.locator("#discussion");
  await discussion.getByRole("textbox", { name: "Add to the discussion" }).fill("Does this apply where the company has since been wound up?\nhttps://example.com/note");
  await discussion.getByRole("button", { name: "Post", exact: true }).click();
  const posted = discussion.getByRole("article").filter({ hasText: "since been wound up" });
  await expect(posted).toBeVisible();
  await expect(shown(discussion, "1 comment · members only")).toBeVisible();
  await expect(posted.getByRole("link", { name: "https://example.com/note" })).toHaveAttribute("rel", /nofollow/);
  // While editing, the text lives in the textarea, so address the comment by its id.
  const comment = page.locator(`[id="${await posted.getAttribute("id")}"]`);

  // Edit within the window.
  await comment.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await comment.getByRole("textbox", { name: "Edit your comment" }).fill("Does this apply where the company has since been dissolved?");
  await comment.getByRole("button", { name: "Save" }).click();
  await expect(shown(discussion, "has since been dissolved?")).toBeVisible();
  await expect(shown(discussion, "· edited")).toBeVisible();

  // A second member replies and likes; the first gets notified.
  const bobContext = await browser.newContext();
  await signIn(bobContext, BOB);
  const bob = await bobContext.newPage();
  await bob.goto(`${casePath()}#discussion`);
  const bobView = bob.locator("#discussion").getByRole("article").filter({ hasText: "has since been dissolved?" });
  await bobView.getByRole("button", { name: "Like comment" }).click();
  await expect(bobView.getByRole("button", { name: "Unlike comment" })).toContainText("1");
  await bobView.getByRole("button", { name: "Reply", exact: true }).click();
  await bob.locator("#discussion").getByRole("textbox", { name: /^Reply to/ }).fill("Yes — the principle is about arraignment, not the company's status.");
  await bob.locator("#discussion").getByRole("button", { name: "Reply", exact: true }).last().click();
  // The posted reply (an article), not the composer that still holds the same words while it is sent.
  await expect(bob.locator("#discussion").getByRole("article").filter({ hasText: "the principle is about arraignment" })).toBeVisible();
  // Members cannot edit or delete someone else's comment.
  await bobView.getByRole("button", { name: "More options" }).click();
  await expect(bob.getByRole("menuitem", { name: "Report" })).toBeVisible();
  await expect(bob.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
  await bobContext.close();

  await gotoSettled(page, "/notifications");
  // Role queries ignore the hidden copy React keeps while the list refreshes.
  await expect(page.getByRole("link", { name: /replied to your comment on/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /liked your comment on/ })).toBeVisible();

  // The notification opens the thread view with the reply in it.
  await page.getByRole("link", { name: /replied to your comment on/ }).click();
  await expect(page).toHaveURL(/\/thread\//);
  await expect(page.getByRole("article").filter({ hasText: "the principle is about arraignment" })).toBeVisible();
});

test("the discussion is not readable without signing in", async ({ request }) => {
  const html = await (await request.get(casePath())).text();
  expect(html).not.toContain("has since been dissolved?");
  const api = await request.get(`/api/comments?post=00000000-0000-4000-8000-000000000000`);
  expect(api.status()).toBe(401);
});

test("the share sheet offers social targets, copy link and image cards", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(casePath());
  await header(page).getByRole("button", { name: "Share" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Share this ruling" })).toBeVisible();
  await expect(sheet.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me.*utm_source%3Dwhatsapp/);
  await expect(sheet.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", /linkedin\.com\/sharing/);
  await expect(sheet.getByRole("button", { name: /Story card/ })).toBeVisible();

  await sheet.getByRole("button", { name: /Copy link/ }).click();
  await expect(sheet.getByText("Copied")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(`/case-laws/${sample.slug}?utm_source=share`);

  const card = await page.request.get(`/api/cards/${sample.slug}/story`);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toBe("image/png");
});
