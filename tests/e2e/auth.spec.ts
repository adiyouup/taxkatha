import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.describe("access control", () => {
  test("anonymous visitors are sent to sign-in from member areas", async ({ page }) => {
    await page.goto("/admin/import");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Fimport/);
    await expect(page.getByRole("heading", { name: "Welcome to TaxKatha" })).toBeVisible();
  });

  test("members without a staff role cannot see the admin", async ({ page, context }) => {
    await signIn(context, "e2e.member@taxkatha.test", "user");
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
  });

  test("the admin-only template is not served to members", async ({ context }) => {
    await signIn(context, "e2e.member@taxkatha.test", "user");
    const response = await context.request.get("/admin/import/template");
    expect(response.status()).toBe(404);
  });

  test("administrators reach the dashboard and the template", async ({ page, context }) => {
    await signIn(context, "e2e.admin@taxkatha.test", "admin");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
    await expect(page.getByRole("link", { name: "Import", exact: true })).toBeVisible();

    const template = await context.request.get("/admin/import/template");
    expect(template.status()).toBe(200);
    expect(template.headers()["content-type"]).toContain("spreadsheetml");
  });

  test("sign-in never redirects to another site", async ({ page, context }) => {
    await signIn(context, "e2e.member@taxkatha.test", "user");
    await page.goto("/sign-in?next=//evil.example.com/phish");
    await page.waitForURL((url) => url.pathname === "/");
    expect(new URL(page.url()).hostname).toBe(new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000").hostname);
  });
});
