import { expect, test, type Page } from "@playwright/test";

// Staff & access (/admin/staff) on the local stack (scripts/exchange-local-seed.mjs).
// Local servers run without RESEND_API_KEY, so invites fall back to the
// copy-link notice and no email is sent.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):54321/.test(supabaseUrl);
const password = process.env.E2E_STAFF_PASSWORD || (isLocal ? "Local-only-9f2e7c4a!" : "");
const ownerEmail = process.env.E2E_OWNER_EMAIL || "sobautofix@gmail.com";
const salesEmail = process.env.E2E_SALES_EMAIL || "temitopeagbola@gmail.com";
const run = Date.now().toString(36).slice(-6);

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "Desktop staff journeys");
test.skip(!isLocal || !password, "Creates staff accounts, so it runs only against the local stack");

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 60_000 });
}

test("an owner invites, edits, removes and restores a member of staff", async ({ page }) => {
  const name = `Test Staff ${run}`;
  const email = `staff-${run}@example.test`;
  await signIn(page, ownerEmail);
  await page.goto("/admin/staff");
  await expect(page.getByRole("heading", { level: 1, name: "Staff & access" })).toBeVisible();

  const invite = page.getByRole("form", { name: "Invite a staff member" });
  await invite.getByLabel("Name").fill(name);
  await invite.getByLabel("Email").fill(email);
  await invite.getByLabel("Role").selectOption("workshop");
  await invite.getByRole("button", { name: /send invite/i }).click();
  // No email provider locally: the owner gets a one-time set-up link instead.
  await expect(invite.getByLabel("Set-up link")).toHaveValue(/\/auth\/confirm\?token_hash=.+type=recovery/);

  await page.reload();
  const row = page.getByRole("listitem").filter({ hasText: email });
  await expect(row).toContainText("Invited");
  await expect(row).toContainText("Workshop");

  await row.getByRole("button", { name: `Edit ${name}` }).click();
  const edit = row.getByRole("form", { name: `Edit ${name}` });
  await edit.getByLabel("Role").selectOption("sales");
  await edit.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByRole("listitem").filter({ hasText: email })).toContainText("Sales");

  await page.getByRole("listitem").filter({ hasText: email }).getByRole("button", { name: "Remove access" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove access" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: email })).toContainText("Access removed");

  await page.getByRole("listitem").filter({ hasText: email }).getByRole("button", { name: "Restore access" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Restore access" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: email })).toContainText("Invited");

  await expect(page.getByRole("region", { name: "Recent changes" }).or(page.locator("#history"))).toContainText(`restored ${name}'s access`);
});

test("an owner cannot remove or demote themselves", async ({ page }) => {
  await signIn(page, ownerEmail);
  await page.goto("/admin/staff");
  const me = page.getByRole("listitem").filter({ hasText: ownerEmail });
  await expect(me).toContainText("(you)");
  await expect(me.getByRole("button", { name: "Remove access" })).toHaveCount(0);
  await me.getByRole("button", { name: /^Edit/ }).click();
  await expect(me.getByText("You can't change your own role.")).toBeVisible();
});

test("sales staff cannot open Staff & access, invoices or settings", async ({ page }) => {
  await signIn(page, salesEmail);
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Staff & access" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Invoices" })).toHaveCount(0);
  for (const path of ["/admin/staff", "/admin/invoices", "/admin/settings"]) {
    await page.goto(path);
    await expect(page.getByText(/ask an owner to change your role/i)).toBeVisible();
  }
  expect((await page.request.get("/api/admin/invoices/export?format=csv")).status()).toBe(403);
});
