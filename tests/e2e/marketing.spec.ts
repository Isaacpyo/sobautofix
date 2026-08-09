import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function setEssentialCookies(page: import("@playwright/test").Page) {
  await page.addInitScript(() => localStorage.setItem("sob-autofix-consent-v1", JSON.stringify({ analytics: false, functional: false })));
}

test("homepage exposes the primary vehicle journey", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByRole("link", { name: "SOB Autofix home" }).first().locator("img");
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Professional Diagnostics");
  await expect(page.getByLabel("Enter your registration")).toBeVisible();
  await expect(page.getByRole("link", { name: /book appointment/i }).first()).toBeVisible();
});

test("priority landing pages have one clear heading", async ({ page }) => {
  for (const path of ["/diagnostics", "/mobile-mechanic", "/services/vehicle-servicing", "/areas/doncaster", "/cars-for-sale"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page).toHaveTitle(/SOB Autofix/);
  }
});

test("homepage has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("registration context survives into booking", async ({ page }) => {
  await setEssentialCookies(page);
  await page.goto("/vehicle-check");
  await page.getByLabel("Enter your registration").fill("ab12 cde");
  await page.getByRole("button", { name: "Find my vehicle" }).click();
  await expect(page.getByRole("heading", { name: /vauxhall astra/i })).toBeVisible();
  await page.getByRole("button", { name: /that's my vehicle/i }).click();
  await page.getByRole("link", { name: "Warning light is on" }).click();
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByText(/Vauxhall Astra/i)).toBeVisible();
});

test("provider outage offers manual continuation", async ({ page }) => {
  await page.route("**/api/vehicle/lookup", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "Vehicle lookup is unavailable." } }) }));
  await setEssentialCookies(page);
  await page.goto("/vehicle-check");
  await page.getByLabel("Enter your registration").fill("ab12 cde");
  await page.getByRole("button", { name: "Find my vehicle" }).click();
  await expect(page.getByRole("heading", { name: /couldn't confirm/i })).toBeVisible();
  await page.getByRole("button", { name: "Continue manually" }).click();
  await expect(page.getByRole("heading", { name: "What can we help with?" })).toBeVisible();
});

test("quote validation and successful submission", async ({ page }) => {
  await page.route("**/api/enquiries", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, id: "68ae0835-6325-485b-b7e7-cb29e08f2f10", notificationStatus: "sent" }) }));
  await setEssentialCookies(page);
  await page.goto("/get-a-quote");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await page.getByLabel("Name").fill("Test Customer");
  await page.getByRole("textbox", { name: /Phone/ }).fill("07123456789");
  await page.getByLabel("What is happening?").fill("There is an intermittent warning light on the dashboard.");
  await page.getByLabel(/I have read the privacy notice/).check();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("status")).toContainText("request has been received");
});

test("optional integrations remain gated by consent", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('script[src*="googletagmanager"], script[src*="embed.tawk.to"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Essential only" }).click();
  await expect(page.getByRole("region", { name: "Cookie preferences" })).toHaveCount(0);
  await expect(page.evaluate(() => localStorage.getItem("sob-autofix-consent-v1"))).resolves.toContain('"analytics":false');
});

test("admin login exposes only the password field", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("sobautofix@gmail.com", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/secure sign-in link/i)).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
});

test("mobile navigation is keyboard operable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).not.toBeVisible();
});
