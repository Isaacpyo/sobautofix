import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

// SOB Auto Exchange customer journeys against the local stack with demo data:
//   pnpm exec supabase start && node scripts/exchange-local-seed.mjs
// The suite uses the /exchange fallback path (no exchange host needed) and
// skips itself when the demo stock is not present.

const FOCUS = "demo-2019-ford-focus-zetec";
const YARIS = "demo-2020-toyota-yaris-hybrid";

async function prepare(page: Page) {
  // Each test is its own visitor, so repeated local runs do not hit the per-visitor rate limits.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}` });
  await page.addInitScript(() => localStorage.setItem("sob-autofix-consent-v1", JSON.stringify({ analytics: false, functional: false })));
  await page.route("https://challenges.cloudflare.com/turnstile/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "window.turnstile={render:function(element,options){options.callback('playwright-token');return 'playwright-widget';},remove:function(){}};",
  }));
}

async function requireDemoStock(page: Page) {
  const response = await page.request.get(`/exchange/cars/${FOCUS}`);
  test.skip(!(await response.text()).includes("Ford Focus"), "Seed the local stack with scripts/exchange-local-seed.mjs");
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude("nextjs-portal").analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

test.describe("SOB Auto Exchange customer app", () => {
  test.beforeEach(async ({ page }) => {
    await prepare(page);
    await requireDemoStock(page);
  });

  test("home page shows the journeys, latest cars and no main-site chrome", async ({ page }) => {
    await page.goto("/exchange");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Buy it. Sell it.");
    await expect(page.getByRole("link", { name: "Browse Cars" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Latest cars" })).toBeVisible();
    // Sold cars never appear in the latest list.
    await expect(page.getByRole("region", { name: "Latest cars" }).getByText("Sold", { exact: true })).toHaveCount(0);
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
    await noHorizontalScroll(page);
    await expectAccessible(page);
  });

  test("browse, filter, open a car and request a viewing", async ({ page, isMobile }) => {
    await page.goto("/exchange/cars");
    await expect(page.getByRole("heading", { level: 1, name: "Used cars for sale" })).toBeVisible();
    await expectAccessible(page);

    if (isMobile) {
      await page.getByRole("button", { name: /^Filters/ }).click();
      const drawer = page.getByRole("dialog", { name: /Filters/ });
      await drawer.getByLabel("Make").selectOption("Ford");
      await expect(page).toHaveURL(/make=Ford/);
      await expect(drawer.getByRole("button", { name: /Show 1 car/ })).toBeVisible();
      await drawer.getByRole("button", { name: /Show 1 car/ }).click();
      await expect(page.getByRole("button", { name: /Filters.*1.*active/ })).toBeVisible();
    } else {
      await page.getByRole("complementary", { name: "Filters" }).getByLabel("Make").selectOption("Ford");
      await expect(page).toHaveURL(/make=Ford/);
    }
    await expect(page.getByRole("list", { name: "Active filters" })).toContainText("Ford");
    await expect(page.getByRole("heading", { name: "Vauxhall Astra" })).toHaveCount(0);
    await noHorizontalScroll(page);

    await page.getByRole("link", { name: "Ford Focus" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ford Focus");
    await expect(page.getByRole("link", { name: "Back to results" })).toHaveAttribute("href", /make=Ford/);
    await expect(page.getByRole("heading", { name: "Inspection findings" })).toBeVisible();
    await expect(page.getByText("Not confirmed").first()).toBeVisible();
    await noHorizontalScroll(page);
    await expectAccessible(page);

    await page.getByRole("button", { name: isMobile ? "Book a viewing" : "Book a Viewing" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName(/Enquire about this car/);
    await dialog.getByRole("button", { name: "Request this viewing" }).click();
    await expect(dialog.getByText("Choose a preferred date")).toBeVisible();
    await dialog.getByLabel("Date", { exact: true }).selectOption({ index: 2 });
    await dialog.getByLabel("Time", { exact: true }).selectOption("11:00");
    await dialog.getByLabel("Your name").fill("Playwright Buyer");
    await dialog.getByLabel("Phone number").fill("07000 000999");
    await dialog.getByRole("checkbox").check();
    await expectAccessible(page);
    await dialog.getByRole("button", { name: "Request this viewing" }).click();
    await expect(dialog.getByText("Your viewing request has been sent. It is not confirmed yet.")).toBeVisible();
    await expect(dialog.getByText("Requested time (awaiting confirmation)")).toBeVisible();
    await expect(dialog).toHaveAccessibleName("Viewing requested");

    await dialog.getByRole("button", { name: "Done" }).click();
    await page.getByRole("link", { name: "Back to results" }).click();
    await expect(page).toHaveURL(/\/exchange\/cars\?make=Ford/);
  });

  test("a reserved car takes questions but not viewings", async ({ page }) => {
    await page.goto(`/exchange/cars/${YARIS}`);
    await expect(page.getByText("This car is reserved")).toBeVisible();
    await expect(page.getByRole("button", { name: "Book a Viewing" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ask About This Car" })).toBeVisible();
  });

  test("sell your car: manual details, a photo, and back and forward between steps", async ({ page }) => {
    const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 40, g: 80, b: 160 } } }).jpeg().toBuffer();
    await page.goto("/exchange/sell");
    await page.evaluate(() => sessionStorage.clear());
    await expect(page.getByRole("heading", { name: "Your car", exact: true })).toBeVisible();
    await expectAccessible(page);

    // The manual path works without any lookup provider.
    await page.getByLabel("Registration number").fill("PW12 TST");
    await page.getByRole("button", { name: "Enter the details yourself instead" }).click();
    // Validation keeps the visitor on the step and keeps what they typed.
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByText("Enter the make")).toBeVisible();
    await expect(page.getByText("Enter the mileage")).toBeVisible();
    await expect(page.getByLabel("Registration number")).toHaveValue("PW12 TST");
    await page.getByLabel("Make").fill("Skoda");
    await page.getByLabel("Model", { exact: true }).fill("Fabia");
    await page.getByLabel("Year").fill("2015");
    await page.getByLabel("Current mileage").fill("82000");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page).toHaveURL(/step=condition/);
    // The registration never appears in the URL.
    expect(page.url()).not.toContain("PW12");

    await page.getByLabel("Runs and drives").check();
    await page.getByRole("group", { name: "MOT" }).getByLabel("Not sure").check();
    await page.getByRole("group", { name: "Service history" }).getByLabel("Not sure").check();
    await page.getByRole("group", { name: /outstanding finance/ }).getByLabel("Not sure").check();

    // Browser back returns to the previous step with answers intact; forward returns.
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Your car", exact: true })).toBeVisible();
    await expect(page.getByLabel("Make")).toHaveValue("Skoda");
    await page.goForward();
    await expect(page.getByLabel("Runs and drives")).toBeChecked();

    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.locator("input[type=file][multiple]").setInputFiles({ name: "front.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByRole("list", { name: "Photos added" }).getByRole("listitem")).toHaveCount(1);
    await expectAccessible(page);
    await page.getByRole("button", { name: /^Continue/ }).click();

    await page.getByLabel("Your name").fill("Playwright Seller");
    await page.getByLabel("Phone number").fill("07000 000888");
    await page.getByLabel("Postcode").fill("DN6 9HF");
    await expect(page.getByRole("checkbox", { name: /news about cars/ })).not.toBeChecked();
    await page.getByRole("button", { name: /^Continue/ }).click();

    await expect(page.getByRole("heading", { name: "Check and send" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your car" })).toContainText("2015 Skoda Fabia");
    await page.getByLabel(/I have read how my information/).check();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Send my enquiry" }).click();

    await expect(page.getByRole("heading", { name: "Thank you. We have your enquiry." })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/SELL-\d+/)).toBeVisible();
    await expect(page.getByText("1 uploaded")).toBeVisible();
    await expect(page.getByText(/provisional and subject to inspection and verification/)).toBeVisible();
  });

  test("part exchange keeps the wanted car attached", async ({ page }) => {
    await page.goto(`/exchange/cars/${FOCUS}`);
    await page.getByRole("link", { name: "Part Exchange Your Car" }).click();
    await expect(page).toHaveURL(new RegExp(`/exchange/sell\\?vehicle=${FOCUS}`));
    await expect(page.getByText("Part exchange towards")).toBeVisible();
    await expect(page.getByText("2019 Ford Focus")).toBeVisible();
  });

  test("information pages render with one heading and no unsupported promises", async ({ page }) => {
    for (const path of ["/exchange/how-buying-works", "/exchange/part-exchange", "/exchange/about", "/exchange/contact", "/exchange/more", "/exchange/policies", "/exchange/cars/sold"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("body")).not.toContainText(/guarantee|fully approved/i);
      await noHorizontalScroll(page);
    }
    await page.goto("/exchange/how-buying-works");
    await expect(page.getByText("We do not take payments, deposits or reservations online.")).toBeVisible();
    await expectAccessible(page);
  });

  test("robots.txt blocks indexing outside the production exchange host", async ({ request }) => {
    const robots = await request.get("/exchange/robots.txt");
    expect(await robots.text()).toContain("Disallow: /");
    const sitemap = await request.get("/exchange/sitemap.xml");
    expect(await sitemap.text()).toContain(`/cars/${FOCUS}`);
  });
});
