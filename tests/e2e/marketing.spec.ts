import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function setEssentialCookies(page: import("@playwright/test").Page) {
  await page.addInitScript(() => localStorage.setItem("sob-autofix-consent-v1", JSON.stringify({ analytics: false, functional: false })));
}

async function mockTurnstile(page: import("@playwright/test").Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "window.turnstile={render:function(element,options){options.callback('playwright-token');return 'playwright-widget';},remove:function(){}};",
  }));
}

async function mockVehicleLookup(page: import("@playwright/test").Page) {
  await page.route("**/api/vehicle/lookup", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, vehicle: { registration: "AB12CDE", make: "Vauxhall", model: "Astra", year: 2017, fuelType: "Petrol" } }),
  }));
}

test("homepage exposes the primary vehicle journey", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByRole("link", { name: "SOB Autofix home" }).first().locator("img");
  await expect(logo).toBeVisible();
  await logo.scrollIntoViewIfNeeded();
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
  await mockVehicleLookup(page);
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
  await mockTurnstile(page);
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

test("contact page is compact and submits a general enquiry", async ({ page }) => {
  let submittedType = "";
  await page.route("**/api/enquiries", async (route) => {
    submittedType = (route.request().postDataJSON() as { type?: string }).type || "";
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, id: "68ae0835-6325-485b-b7e7-cb29e08f2f10", notificationStatus: "sent" }) });
  });
  await mockTurnstile(page);
  await setEssentialCookies(page);
  await page.goto("/contact");

  await expect(page.getByText("Call, WhatsApp or send the details online.", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Professional testing", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Clear next steps", { exact: true })).toHaveCount(0);
  const formHeading = page.getByRole("heading", { name: "Send a general enquiry" });
  await expect(formHeading).toBeVisible();
  await expect.poll(async () => {
    const box = await formHeading.boundingBox();
    return box ? box.y < (page.viewportSize()?.height || 0) : false;
  }).toBe(true);

  await page.getByLabel("Name").fill("Test Customer");
  await page.getByRole("textbox", { name: /Phone/ }).fill("07123456789");
  await page.getByLabel("What is happening?").fill("The vehicle has an intermittent warning light.");
  await page.getByLabel(/I have read the privacy notice/).check();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByRole("status")).toContainText("request has been received");
  expect(submittedType).toBe("general");
});

test("cars for sale uses a compact title-only hero", async ({ page }) => {
  await page.goto("/cars-for-sale");
  const main = page.getByRole("main");

  await expect(main.getByText("Only genuine, currently approved stock appears here.", { exact: false })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Book appointment", exact: true })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Request an estimate", exact: true })).toHaveCount(0);
  await expect(main.getByText("Professional testing", { exact: true })).toHaveCount(0);
  await expect(main.getByText("Clear next steps", { exact: true })).toHaveCount(0);
  const stockHeading = main.getByRole("heading", { name: "Available vehicles" });
  await expect(stockHeading).toBeVisible();
  await expect.poll(async () => {
    const box = await stockHeading.boundingBox();
    return box ? box.y < (page.viewportSize()?.height || 0) : false;
  }).toBe(true);
});

test("notification centre is protected by admin authentication", async ({ page }) => {
  await page.goto("/admin/notifications");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("optional integrations remain gated by consent", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('script[src*="googletagmanager"], script[src*="embed.tawk.to"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Essential only" }).click();
  await expect(page.getByRole("region", { name: "Cookie preferences" })).toHaveCount(0);
  await expect(page.evaluate(() => localStorage.getItem("sob-autofix-consent-v1"))).resolves.toContain('"analytics":false');
});

test("admin login accepts email and password without displaying the allowed address", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("sobautofix@gmail.com", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/secure sign-in link/i)).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveValue("");
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
