import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Vehicle Buying & Selling staff journeys on the local stack (seeded with
// scripts/exchange-local-seed.mjs). Runs serially: the reservation journey
// uses the vehicle published by the stock journey.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):54321/.test(supabaseUrl);
const password = process.env.E2E_STAFF_PASSWORD || (isLocal ? "Local-only-9f2e7c4a!" : "");
const ownerEmail = process.env.E2E_OWNER_EMAIL || "sobautofix@gmail.com";
const salesEmail = process.env.E2E_SALES_EMAIL || "temitopeagbola@gmail.com";
const run = `${Date.now().toString(36).slice(-5).toUpperCase()}`;
const photoDir = join(process.cwd(), "assets");
const photos = readdirSync(photoDir).filter((name) => name.startsWith("sobautofix images")).slice(0, 4).map((name) => join(photoDir, name));

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "Desktop staff journeys; mobile layouts are checked separately");
test.skip(!password, "Staff test logins are only available on the local stack (or set E2E_STAFF_PASSWORD)");

// Sign-in is rate limited, so each role signs in once and the session is reused.
const sessions = new Map<string, Awaited<ReturnType<BrowserContext["storageState"]>>>();

async function signIn(page: Page, email: string) {
  const saved = sessions.get(email);
  if (saved) {
    await page.context().addCookies(saved.cookies);
    return;
  }
  await page.context().clearCookies();
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 60_000 });
  sessions.set(email, await page.context().storageState());
}

async function confirmDialog(page: Page, name: RegExp | string) {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name }).click();
}

async function publicListing(page: Page, slug: string) {
  // The customer app serves /exchange/cars; the main site keeps /cars-for-sale.
  const exchange = await page.request.get(`/exchange/cars/${slug}`);
  return exchange.ok() ? `/exchange/cars/${slug}` : `/cars-for-sale/${slug}`;
}

/** The vehicle's card in the public catalogue, which carries the Reserved / Sold marker. */
async function publicCard(page: Page, slug: string, { sold = false } = {}) {
  // Sold cars leave the catalogue for the Recently sold archive.
  const exchange = sold ? "/exchange/cars/sold" : "/exchange/cars";
  const catalogue = (await page.request.get(exchange)).ok() ? exchange : "/cars-for-sale";
  await page.goto(catalogue);
  // The whole card, not just its title link: the status badge sits beside the link.
  return page.locator(`a[href$="/${slug}"]`).first().locator("xpath=ancestor::*[self::article or self::li][1]");
}

let publishedVehicle = { id: "", slug: "", title: "" };

test("stock: draft, disclosures and photos, publishing blocked until ready, then live", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, ownerEmail);
  await page.goto("/admin/exchange/stock/new");
  await page.getByLabel("Registration number").fill(`E2E${run}`.slice(0, 8));
  await page.getByRole("button", { name: "Look up vehicle" }).click();
  const confirm = page.getByRole("button", { name: "Confirm & continue" });
  const manual = page.getByRole("button", { name: "Enter details manually" });
  await expect(confirm.or(manual)).toBeVisible({ timeout: 30_000 });
  if (await manual.isVisible()) {
    // Lookup provider unavailable: the flow falls back to manual entry.
    await manual.click();
    await page.locator("select[name=make]").selectOption("Vauxhall");
    await page.locator("select[name=model]").selectOption("Astra");
    await page.locator("select[name=year]").selectOption("2017");
    await page.locator("select[name=fuelType]").selectOption("Petrol");
  } else {
    await confirm.click();
  }
  await page.locator("select[name=transmission]").selectOption("Manual");
  await page.getByLabel("Current mileage").fill("42000");
  await page.getByLabel("Asking price (£)").fill("5995");
  await page.getByLabel("Description").fill(`End-to-end test vehicle ${run}. Clean interior and recent service.`);
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/admin\/exchange\/stock\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const id = page.url().split("/").pop()!;
  await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();

  // Publishing is blocked until the checklist is complete.
  await page.goto(`/admin/exchange/stock/${id}?tab=status`);
  await expect(page.getByRole("radio", { name: /Available/ })).toBeDisabled();
  await expect(page.getByText(/Finish the publishing checklist first/)).toBeVisible();

  await page.goto(`/admin/exchange/stock/${id}?tab=condition`);
  await page.getByLabel("Insurance write-off").selectOption("none_recorded");
  await page.getByLabel("Condition summary").fill("Light marks on the rear bumper; interior clean and complete.");
  await page.getByLabel("MOT expiry").fill("2027-05-01");
  await page.getByRole("button", { name: "Save condition and disclosures" }).click();
  await expect(page.getByText("Condition and disclosures saved.")).toBeVisible();

  await page.goto(`/admin/exchange/stock/${id}?tab=photos`);
  await page.getByLabel("Add photos").setInputFiles(photos);
  await expect(page.getByText(`${photos.length} of ${photos.length} uploaded`)).toBeVisible({ timeout: 120_000 });
  await page.reload();
  await expect(page.getByRole("img", { name: /photo/i })).toHaveCount(photos.length);

  await page.goto(`/admin/exchange/stock/${id}?tab=status`);
  await page.getByRole("radio", { name: /Available/ }).check();
  await page.getByRole("button", { name: "Publish" }).click();
  await confirmDialog(page, "Publish");
  await expect(page.getByText("Status changed to Available.")).toBeVisible({ timeout: 30_000 });

  const href = await page.getByRole("link", { name: "View public listing" }).getAttribute("href");
  const slug = href!.split("/").pop()!;
  publishedVehicle = { id, slug, title: "Vauxhall Astra" };
  await page.goto(await publicListing(page, slug));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Vauxhall Astra/);
});

test("permissions: the sales role cannot see costs or change the price", async ({ page }) => {
  test.skip(!publishedVehicle.id, "Needs the published vehicle");
  await signIn(page, salesEmail);
  await page.goto(`/admin/exchange/stock/${publishedVehicle.id}`);
  await expect(page.getByRole("link", { name: /Costs/ })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Vehicle Buying & Selling sections" }).getByRole("button", { name: /^Finance & settings/ })).toHaveCount(0);
  await expect(page.getByLabel(/Advertised price/)).toHaveAttribute("readonly", "");
  await page.goto(`/admin/exchange/stock/${publishedVehicle.id}?tab=costs`);
  await expect(page.getByText("Gross margin")).toHaveCount(0);
  await page.goto("/admin/exchange/reports");
  await expect(page.getByText("You don't have access to this area")).toBeVisible();
  const csv = await page.request.get("/api/admin/exchange/reports/export");
  expect(csv.status()).toBe(403);
});

test("navigation: reporting and settings sit under Finance & settings", async ({ page }) => {
  await signIn(page, ownerEmail);
  await page.goto("/admin/exchange");
  const sections = page.getByRole("navigation", { name: "Vehicle Buying & Selling sections" });
  const more = sections.getByRole("button", { name: /^Finance & settings/ });
  await expect(sections.getByRole("link", { name: "Sales & Handover" })).toBeVisible();
  await expect(more).toBeVisible();
  await expect(sections.getByRole("link", { name: "Settings" })).toBeHidden();
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(more).toBeFocused();
  await more.click();
  await sections.getByRole("link", { name: "Costs & Reporting" }).click();
  await expect(page).toHaveURL(/\/admin\/exchange\/reports$/);
  await expect(more).toHaveAccessibleName(/current section: Costs & Reporting/);
  await more.click();
  await sections.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/admin\/exchange\/settings$/);
});

test("buying: enquiry, offer history, purchase and a linked stock draft", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, ownerEmail);
  await page.goto("/admin/exchange/enquiries/new?type=buying");
  await page.getByLabel("Name").fill(`E2E Seller ${run}`);
  await page.getByLabel("Phone").fill("07000 000099");
  await page.getByLabel("Email").fill(`seller-${run.toLowerCase()}@example.test`);
  await page.getByLabel("Make").fill("Skoda");
  await page.getByLabel("Model").fill("Fabia");
  await page.getByLabel("Year").fill("2016");
  await page.getByLabel("Mileage").fill("61000");
  await page.getByLabel("Fuel").selectOption("Petrol");
  await page.getByLabel("Transmission").selectOption("Manual");
  await page.getByLabel("What the customer wants").fill("Wants an offer for their Fabia; has the V5C and service book.");
  await page.getByRole("button", { name: "Create enquiry" }).click();
  await expect(page).toHaveURL(/\/admin\/exchange\/buying\/[0-9a-f-]{36}$/, { timeout: 60_000 });

  await page.getByRole("button", { name: "Start reviewing" }).click();
  await expect(page.getByText("Marked as reviewing.")).toBeVisible();

  // Provisional offer, then a final offer that supersedes it.
  await page.getByLabel("Type of offer").selectOption("provisional");
  await page.getByLabel(/^Offer/).fill("2800");
  await page.getByRole("button", { name: "Record offer" }).click();
  await expect(page.getByText(/Provisional offer recorded/)).toBeVisible();
  await page.getByText(/Make a new offer/).click();
  await page.getByLabel("Type of offer").selectOption("final");
  await page.getByLabel(/^Offer/).fill("3000");
  await page.getByRole("button", { name: "Record offer" }).click();
  await expect(page.getByText(/Final offer recorded/)).toBeVisible();
  const history = page.locator("section", { has: page.getByRole("heading", { name: "Offer history" }) });
  await expect(history.getByText("Superseded", { exact: true })).toBeVisible();

  await page.getByLabel("Record the outcome").selectOption("accepted");
  await page.getByRole("button", { name: "Record outcome" }).click();
  await confirmDialog(page, "Record outcome");
  await expect(page.getByText("Offer marked as accepted.")).toBeVisible();
  await expect(history.getByText("Accepted", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Mark as purchased" }).click();
  await confirmDialog(page, "Mark as purchased");
  await expect(page.getByText(/Marked as purchased/)).toBeVisible();

  await page.getByRole("button", { name: "Create stock draft" }).click();
  await expect(page).toHaveURL(/\/admin\/exchange\/stock\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /2016 Skoda Fabia/ })).toBeVisible();
  const stockUrl = page.url().split("?")[0]!;
  await page.goto(`${stockUrl}?tab=costs`);
  await expect(page.getByRole("cell", { name: /^Purchase from seller \(SELL-/ })).toBeVisible();
  // Seller details never reach the listing.
  await page.goto(`${stockUrl}?tab=listing`);
  await expect(page.getByText(`E2E Seller ${run}`)).toHaveCount(0);
});

test("selling: reserve, cancel, reserve again and complete the sale", async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(!publishedVehicle.id, "Needs the published vehicle");
  await signIn(page, ownerEmail);
  await page.goto(`/admin/exchange/enquiries/new?type=sales&vehicle=${publishedVehicle.id}`);
  await page.getByLabel("Name").fill(`E2E Buyer ${run}`);
  await page.getByLabel("Phone").fill("07000 000098");
  await page.getByLabel("What the customer wants").fill("Called about the Astra and wants to reserve it today.");
  await page.getByRole("button", { name: "Create enquiry" }).click();
  await expect(page).toHaveURL(/\/admin\/exchange\/sales\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const enquiryUrl = page.url();

  async function reserve() {
    await page.goto(enquiryUrl);
    await page.getByRole("button", { name: "Reserve this vehicle" }).click();
    await confirmDialog(page, "Reserve vehicle");
    await expect(page).toHaveURL(/\/admin\/exchange\/handover\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  }

  await reserve();
  await expect(await publicCard(page, publishedVehicle.slug)).toContainText(/Reserved/i);
  await page.goBack();

  await page.getByLabel("Reason").fill("Buyer changed their mind");
  await page.getByRole("button", { name: "Cancel reservation" }).click();
  await confirmDialog(page, "Cancel reservation");
  await expect(page.getByText(/Reservation cancelled/)).toBeVisible();
  await page.goto(`/admin/exchange/stock/${publishedVehicle.id}`);
  await expect(page.getByText("Available", { exact: true }).first()).toBeVisible();

  await reserve();
  for (const tick of await page.getByRole("button", { name: /^Tick/ }).all()) {
    await tick.click();
    await page.waitForLoadState("networkidle");
  }
  await page.getByRole("button", { name: "Complete sale" }).click();
  await confirmDialog(page, "Complete sale");
  await expect(page.getByText(/Sale completed/).first()).toBeVisible({ timeout: 30_000 });

  await page.goto(`/admin/exchange/stock/${publishedVehicle.id}`);
  await expect(page.getByText("Sold", { exact: true }).first()).toBeVisible();
  await expect(await publicCard(page, publishedVehicle.slug, { sold: true })).toContainText(/Sold/i);
});
