import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { fetchRsc, gatedSample, shown, signIn, type GatedSample } from "./helpers";

/*
 * Editorial Insights: an administrator writes and publishes; readers get a
 * rendered article; members-only articles are gated like case-law analysis.
 */
const ADMIN = "e2e.editor@taxkatha.test";
const TITLE = `E2E insight ${Date.now()}`;
const SECRET = "members-only-paragraph-zq7";
// A 1×1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

let sample: GatedSample;
let slug = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  sample = await gatedSample();
});

test.afterAll(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await pool.query(`DELETE FROM posts WHERE type = 'insight' AND title LIKE 'E2E insight %'`);
    await pool.query(`DELETE FROM "user" WHERE email = $1`, [ADMIN]);
  } finally {
    await pool.end();
  }
});

test("an administrator writes, illustrates and publishes an insight", async ({ page, context }) => {
  await signIn(context, ADMIN, "admin");
  await page.goto("/admin/insights/new");

  await page.getByRole("textbox", { name: "Title", exact: true }).fill(TITLE);
  await page.getByRole("textbox", { name: "Standfirst" }).fill("Why the arraignment rule matters for every director facing a GST prosecution this year.");

  const editor = page.locator(".tiptap");
  await editor.click();
  await page.keyboard.type("The rule in one line");
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.keyboard.press("Enter");
  await page.keyboard.type("A company must be arraigned before its officers can be prosecuted.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("What changes in practice");
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Check every complaint for this defect first.");
  await page.keyboard.press("Enter");

  // Embed a ruling, found by pasting its link.
  await page.getByRole("button", { name: "Embed a ruling" }).click();
  const embed = page.getByRole("dialog", { name: "Embed a ruling" });
  await embed.getByLabel("Find a ruling").fill(`/case-laws/${sample.slug}`);
  await embed.getByRole("button", { name: sample.title }).first().click();
  await expect(editor.locator("[data-case-embed]")).toHaveText(sample.slug);

  // Upload an inline image and describe it.
  await page.getByLabel("Image file").setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: PNG });
  const describe = page.getByRole("dialog", { name: "Describe the image" });
  await describe.getByLabel("Alt text").fill("A test chart");
  await describe.getByRole("button", { name: "Insert image" }).click();
  await expect(editor.locator("img")).toHaveAttribute("src", /^\/uploads\/insights\/.+\.png$/);

  // A link with its own text, since nothing is selected.
  await page.getByRole("button", { name: "Link", exact: true }).click();
  const link = page.getByRole("dialog", { name: "Add a link" });
  await link.getByLabel("Link address").fill("javascript:alert(1)");
  await link.getByRole("button", { name: "Add link" }).click();
  await expect(link.getByRole("alert")).toBeVisible();
  await link.getByLabel("Link address").fill("https://www.gst.gov.in/");
  await link.getByLabel("Text to show").fill("the GST portal");
  await link.getByRole("button", { name: "Add link" }).click();
  await expect(editor.getByRole("link", { name: "the GST portal" })).toHaveAttribute("href", "https://www.gst.gov.in/");

  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();
  await page.waitForURL(/\/admin\/insights\/[0-9a-f-]{36}$/);
  slug = (await page.getByLabel("Web address").inputValue()).trim();
  expect(slug).toMatch(/^e2e-insight-/);
});

test("readers get the rendered article with headings, the embedded ruling and the image", async ({ page }) => {
  await page.goto(`/insights/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  await expect(page.getByRole("heading", { level: 2, name: "The rule in one line" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "In this article" }).getByRole("link", { name: "What changes in practice" })).toBeVisible();
  await expect(page.getByRole("article").getByRole("heading", { name: sample.title })).toBeVisible();
  await expect(page.locator("article img[alt='A test chart']")).toBeVisible();

  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  const card = await page.request.get(`/api/cards/${slug}/square`);
  expect(card.status()).toBe(200);
});

test("only uploads that really are images are accepted, and only from administrators", async ({ browser, context }) => {
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.post("/api/admin/upload", { multipart: { file: { name: "x.png", mimeType: "image/png", buffer: PNG } } });
  expect(denied.status()).toBe(401);
  await anonymous.close();

  await signIn(context, ADMIN, "admin");
  const fake = await context.request.post("/api/admin/upload", {
    multipart: { file: { name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") } },
  });
  expect(fake.status()).toBe(400);
});

test("a members-only insight hides its body from anonymous readers", async ({ page, context, browser }) => {
  await signIn(context, ADMIN, "admin");
  await page.goto("/admin/insights");
  await page.getByRole("link", { name: TITLE }).click();
  const editor = page.locator(".tiptap");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(` ${SECRET}`);
  await page.getByRole("checkbox", { name: /Members only/ }).check();
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByText("Published.", { exact: true })).toBeVisible();

  const anonymous = await browser.newContext();
  const visitor = await anonymous.newPage();
  await visitor.goto(`/insights/${slug}`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  await expect(visitor.getByRole("heading", { name: "This insight is for members" })).toBeVisible();
  const html = await (await anonymous.request.get(`/insights/${slug}`)).text();
  expect(html).not.toContain(SECRET);
  const rsc = await fetchRsc(anonymous.request, `/insights/${slug}`);
  expect(rsc.body).not.toContain(SECRET);
  await anonymous.close();

  // The signed-in author can read it.
  await page.goto(`/insights/${slug}`);
  await expect(shown(page, SECRET)).toBeVisible();
});
