import { expect, test } from "@playwright/test";

test("invoice dashboard requires an authenticated admin", async ({ page }) => {
  await page.goto("/admin/invoices");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
  await expect(page.getByText("Outstanding amount")).toHaveCount(0);
});

test("invoice PDFs are not publicly downloadable", async ({ request }) => {
  const response = await request.get("/api/admin/invoices/61b6fbaf-21e8-4eb8-92df-0522f11a9474/pdf");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});
