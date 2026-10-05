import { expect, test } from "@playwright/test";

import { fetchRsc, gatedSample, shown, signIn, type GatedSample } from "./helpers";

/*
 * The access model: the headnote is public; the background, decision and
 * discussion are for signed-in members. Gated text must never reach an
 * anonymous browser — not in the HTML, not in the RSC payload, not in the
 * share images' source data.
 */
let sample: GatedSample;

test.beforeAll(async () => {
  sample = await gatedSample();
});

test.describe("anonymous visitor", () => {
  test("sees the public teaser and a sign-in gate", async ({ page }) => {
    await page.goto(`/case-laws/${sample.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(sample.title);
    await expect(shown(page, "The ruling in brief")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Read the full analysis" })).toBeVisible();
    await expect(page.getByText(sample.decision)).toHaveCount(0);
  });

  test("never receives gated text in the HTML", async ({ request }) => {
    const html = await (await request.get(`/case-laws/${sample.slug}`)).text();
    expect(html).toContain(sample.headnote);
    expect(html).not.toContain(sample.background);
    expect(html).not.toContain(sample.decision);
  });

  test("never receives gated text in the RSC payload", async ({ request }) => {
    const rsc = await fetchRsc(request, `/case-laws/${sample.slug}`);
    expect(rsc.status).toBe(200);
    expect(rsc.body).not.toContain(sample.background);
    expect(rsc.body).not.toContain(sample.decision);
  });

  test("cannot find a case by words that appear only in its gated text", async ({ request }) => {
    const html = await (await request.get(`/case-laws?q=${encodeURIComponent(`"${sample.decision}"`)}`)).text();
    expect(html).not.toContain(sample.title);
  });
});

test.describe("signed-in member", () => {
  test("reads the full analysis", async ({ page, context }) => {
    await signIn(context, "e2e.member@taxkatha.test");
    await page.goto(`/case-laws/${sample.slug}`);
    await expect(page.getByRole("heading", { name: "Background and issue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Decision", exact: true })).toBeVisible();
    await expect(shown(page, sample.decision)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Read the full analysis" })).toHaveCount(0);
  });

  test("loses access again after signing out", async ({ page, context }) => {
    await signIn(context, "e2e.member@taxkatha.test");
    await page.goto(`/case-laws/${sample.slug}`);
    await expect(shown(page, sample.decision)).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL("/");

    await page.goto(`/case-laws/${sample.slug}`);
    await expect(page.getByRole("heading", { name: "Read the full analysis" })).toBeVisible();
    await expect(page.getByText(sample.decision)).toHaveCount(0);
  });
});
