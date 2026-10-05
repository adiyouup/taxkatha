import { expect, test } from "@playwright/test";

import { TOOLS } from "../../src/lib/tools/registry";
import { shown } from "./helpers";

/* The calculators: every page renders, inputs recalculate, and a shared link reopens the same calculation. */

test("the hub lists every calculator", async ({ page }) => {
  await page.goto("/tools");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tax and money, worked out");
  for (const tool of TOOLS) await expect(page.getByRole("link", { name: new RegExp(tool.name) }).first()).toBeVisible();
});

test("every calculator page renders a result", async ({ page }) => {
  for (const tool of TOOLS) {
    const response = await page.goto(`/tools/${tool.slug}`);
    expect(response?.status(), tool.slug).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(tool.name);
    await expect(page.locator(".type-numeral").first()).not.toBeEmpty();
  }
});

test("typing a value recalculates and goes into the address", async ({ page }) => {
  await page.goto("/tools/emi-calculator");
  const amount = page.getByRole("textbox", { name: "Loan amount" }).filter({ visible: true });
  await amount.fill("2000000");
  await amount.press("Enter");
  // ₹20 lakh at 10% for 5 years.
  await expect(shown(page, "₹42,494").first()).toBeVisible();
  await expect(page).toHaveURL(/amount=2000000/);
});

test("a shared link opens the same calculation", async ({ page }) => {
  await page.goto("/tools/sip-calculator?amount=5000&rate=12&years=20&stepup=0");
  await expect(page.getByRole("textbox", { name: "Monthly investment" }).filter({ visible: true })).toHaveValue("5,000");
  await expect(shown(page, "₹12,00,000").first()).toBeVisible(); // invested over 20 years
});

test("the income tax calculator picks the cheaper regime", async ({ page }) => {
  await page.goto("/tools/income-tax-calculator?salary=1275000&other=0&c80=0&d80=0");
  await expect(shown(page, "Lower tax: new regime")).toBeVisible();
  await expect(page.locator(".type-numeral").filter({ visible: true }).first()).toHaveText("₹0");
});

test("GST is split into CGST and SGST within a state", async ({ page }) => {
  await page.goto("/tools/gst-calculator?amount=1000&rate=18&mode=add&supply=intra");
  await expect(page.locator(".type-numeral").filter({ visible: true }).first()).toHaveText("₹1,180.00");
  await expect(shown(page, "CGST (9%)")).toBeVisible();
});
