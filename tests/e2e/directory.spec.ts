import { expect, test } from "@playwright/test";

import { shown } from "./helpers";

test.describe("case-law directory", () => {
  test("lists rulings with filters in the URL", async ({ page }) => {
    await page.goto("/case-laws");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every ruling");
    await expect(shown(page, /\d+ rulings/).first()).toBeVisible();
    // Featured posts sit in their own section above the results.
    await expect(page.getByRole("list", { name: "Results" }).getByRole("article")).toHaveCount(20);
  });

  test("searches and narrows by outcome", async ({ page }) => {
    await page.goto("/case-laws");
    await page.getByRole("searchbox", { name: "Search case laws" }).fill("input tax credit");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=input\+tax\+credit/);
    await expect(shown(page, /rulings? found/)).toBeVisible();

    await page.getByRole("complementary", { name: "Filters" }).getByRole("link", { name: /In favour of assessee/ }).click();
    await expect(page).toHaveURL(/outcome=assessee/);
    await expect(page.getByRole("list", { name: "Active filters" })).toContainText("In favour of assessee");

    // Every visible result carries the chosen outcome.
    const pills = page.getByRole("article").getByText("For assessee", { exact: true });
    expect(await pills.count()).toBe(await page.getByRole("article").count());
  });

  test("ignores malformed parameters instead of failing", async ({ page }) => {
    const response = await page.goto("/case-laws?outcome=%27%3B--&page=-5&forum=nope&from=yesterday");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("article").first()).toBeVisible();
  });

  test("paginates", async ({ page }) => {
    await page.goto("/case-laws");
    const firstTitle = await page.getByRole("article").first().getByRole("heading").innerText();
    await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("article").first().getByRole("heading")).not.toHaveText(firstTitle);
  });

  test("topic and court hubs fix their filter", async ({ page }) => {
    await page.goto("/topics/input-tax-credit");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Input tax credit");
    await expect(page.getByRole("article").first()).toBeVisible();

    await page.goto("/courts/supreme-court-of-india");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Supreme Court of India");
    await expect(shown(page, /24 rulings/)).toBeVisible();
  });

  test("unknown ruling shows the branded 404", async ({ page }) => {
    await page.goto("/case-laws/this-ruling-does-not-exist");
    await expect(shown(page, "not on the record")).toBeVisible();
  });
});
