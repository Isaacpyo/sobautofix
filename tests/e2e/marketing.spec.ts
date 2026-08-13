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

test("service category headings link to the canonical hubs", async ({ page, isMobile }) => {
  await page.goto("/");
  const expected = [
    { label: "Diagnostics", href: "/diagnostics" },
    { label: "Repairs & Maintenance", href: "/services/repairs-maintenance" },
    { label: "Mobile & Specialist", href: "/services/mobile-specialist" },
  ];

  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    const navigation = page.getByRole("navigation", { name: "Mobile navigation" });
    await navigation.getByRole("button", { name: "Services", exact: true }).click();
    for (const item of expected) await expect(navigation.getByRole("link", { name: item.label, exact: true })).toHaveAttribute("href", item.href);
    return;
  }

  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  const servicesButton = navigation.getByRole("button", { name: "Services", exact: true });
  await servicesButton.focus();
  await page.keyboard.press("Enter");
  for (const item of expected) await expect(navigation.getByRole("link", { name: item.label, exact: true })).toHaveAttribute("href", item.href);
  await page.keyboard.press("Tab");
  await expect(navigation.getByRole("link", { name: "Diagnostics", exact: true })).toBeFocused();
});

test("service category hubs expose complete cards, breadcrumbs, canonicals and schema", async ({ page }) => {
  const seoTitles = new Set<string>();
  const categories = [
    {
      route: "/diagnostics",
      title: "Vehicle Diagnostics & Fault Finding in Doncaster",
      cards: [
        ["Vehicle Diagnostics", "/diagnostics/car-diagnostics"],
        ["Electrical Fault Finding", "/diagnostics/electrical-fault-finding"],
        ["Engine Management Light", "/diagnostics/engine-management-light"],
        ["ECU Diagnostics", "/diagnostics/ecu-diagnostics"],
        ["ABS Diagnostics", "/diagnostics/abs-diagnostics"],
        ["DPF Diagnostics", "/diagnostics/dpf-diagnostics"],
        ["Battery & Charging Diagnostics", "/diagnostics/battery-charging"],
      ],
    },
    {
      route: "/services/repairs-maintenance",
      title: "Vehicle Repairs & Maintenance in Doncaster",
      cards: [
        ["Vehicle Servicing", "/services/vehicle-servicing"],
        ["Engine Repairs", "/services/engine-repair"],
        ["Brake Repairs", "/services/brake-repair"],
      ],
    },
    {
      route: "/services/mobile-specialist",
      title: "Mobile & Specialist Vehicle Services in Doncaster",
      cards: [
        ["Mobile Mechanic", "/mobile-mechanic"],
        ["Vehicle Recovery", "/vehicle-recovery"],
        ["Pre-Purchase Inspection", "/vehicle-inspections"],
        ["Fleet Servicing", "/fleet"],
      ],
    },
  ] as const;

  for (const category of categories) {
    const response = await page.goto(category.route);
    expect(response?.status()).toBe(200);
    seoTitles.add(await page.title());
    await expect(page.getByRole("heading", { level: 1, name: category.title })).toBeVisible();
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBeTruthy();
    expect(new URL(canonical!).pathname).toBe(category.route);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Services");
    for (const [title, href] of category.cards) {
      const heading = page.getByRole("heading", { level: 3, name: title, exact: true }).first();
      await expect(heading).toBeVisible();
      await expect(heading.locator("..")).toHaveAttribute("href", href);
    }
    const schemaTypes = await page.locator('script[type="application/ld+json"]').evaluateAll((scripts) => scripts.map((script) => JSON.parse(script.textContent || "{}")["@type"]));
    expect(schemaTypes).toContain("BreadcrumbList");
    expect(schemaTypes).toContain("FAQPage");
    expect(schemaTypes).toContain("Service");
  }
  expect(seoTitles.size).toBe(categories.length);
});

test("services index presents all three substantial category gateways", async ({ page }) => {
  const response = await page.goto("/services");
  expect(response?.status()).toBe(200);
  for (const [label, href] of [["Explore Diagnostics", "/diagnostics"], ["Explore Repairs & Maintenance", "/services/repairs-maintenance"], ["Explore Mobile & Specialist", "/services/mobile-specialist"]] as const) {
    await expect(page.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
  }
});

test("service category hubs have no automatically detectable accessibility violations", async ({ page }) => {
  for (const route of ["/diagnostics", "/services/repairs-maintenance", "/services/mobile-specialist"]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, route).toEqual([]);
  }
});

test("sitemap contains all canonical service category routes", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const sitemap = await response.text();
  for (const route of ["/diagnostics", "/services/repairs-maintenance", "/services/mobile-specialist"]) expect(sitemap).toContain(route);
  expect(sitemap).not.toContain("/services/diagnostics");
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  expect(locations.length).toBeGreaterThan(0);
  expect(new Set(locations).size).toBe(locations.length);
  expect(locations.every((location) => location?.startsWith("https://sobautofix.com/"))).toBe(true);
});

test("homepage has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("registration context survives into booking", async ({ page }) => {
  await mockVehicleLookup(page);
  await page.route("**/api/bookings/services", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ services: [{ key: "vehicle-servicing", name: "Vehicle Servicing", description: "Scheduled servicing and vehicle health checks.", locationMode: "workshop" }] }),
  }));
  await setEssentialCookies(page);
  await page.goto("/vehicle-check");
  await page.getByLabel("Enter your registration").fill("ab12 cde");
  await page.getByRole("button", { name: "Find my vehicle" }).click();
  await expect(page.getByRole("heading", { name: /vauxhall astra/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /vauxhall astra/i })).toBeVisible();
  await page.getByRole("button", { name: /that's my vehicle/i }).click();
  await expect(page.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();
  const servicingLink = page.getByRole("main").getByRole("link", { name: "Vehicle Servicing", exact: true });
  await expect(servicingLink).toBeVisible();
  await servicingLink.click();
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole("heading", { name: "Which vehicle are we booking in?" })).toBeVisible();
  await expect(page.getByText("Vauxhall Astra", { exact: true })).toBeVisible();
});

test("provider outage offers manual continuation", async ({ page }) => {
  await page.route("**/api/vehicle/lookup", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "Vehicle lookup is unavailable." } }) }));
  await setEssentialCookies(page);
  await page.goto("/vehicle-check");
  await page.getByLabel("Enter your registration").fill("ab12 cde");
  await page.getByRole("button", { name: "Find my vehicle" }).click();
  await expect(page.getByRole("heading", { name: /couldn't confirm/i })).toBeVisible();
  await page.getByRole("button", { name: "Continue manually" }).click();
  await expect(page.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();
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

test("enquiry conversation detail is protected by admin authentication", async ({ page }) => {
  await page.goto("/admin/enquiries/68ae0835-6325-485b-b7e7-cb29e08f2f10");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("operations dashboard is protected by admin authentication", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("registration-first inventory creation is protected by admin authentication", async ({ page }) => {
  await page.goto("/admin/inventory/new");
  await expect(page).toHaveURL(/\/admin\/login$/);
  const response = await page.request.post("/api/admin/inventory/lookup", { data: { registration: "LM17XXA" } });
  expect(response.status()).toBe(401);
});

test("news listing, feed and former advice routes behave correctly", async ({ page, request }) => {
  const response = await page.goto("/news");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "News & Blog" })).toBeVisible();

  const feed = await request.get("/news/feed.xml");
  expect(feed.status()).toBe(200);
  expect(feed.headers()["content-type"]).toContain("application/rss+xml");
  expect(await feed.text()).toContain("<rss version=\"2.0\">");

  const advice = await request.get("/advice", { maxRedirects: 0 });
  expect(advice.status()).toBe(308);
  expect(advice.headers().location).toBe("/news");
  await page.goto("/advice");
  await expect(page).toHaveURL(/\/news$/);

  const missingArticle = await page.goto("/news/article-that-does-not-exist");
  expect(missingArticle?.status()).toBe(404);
});

test("News & Blog is present in public navigation and the footer", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "News & Blog" })).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "News & Blog" })).toBeVisible();
  }
  await expect(page.getByRole("navigation", { name: "Explore footer links" }).getByRole("link", { name: "News & Blog" })).toHaveAttribute("href", "/news");
});

test("News sitemap and homepage reflect only genuine published articles", async ({ page, request }) => {
  const sitemap = await request.get("/sitemap.xml");
  const sitemapBody = await sitemap.text();
  expect(sitemap.status()).toBe(200);
  expect(sitemapBody).toContain("https://sobautofix.com/news");
  expect(sitemapBody).not.toContain("https://sobautofix.com/advice");

  await page.goto("/news");
  const publishedLinks = page.locator('main a[href^="/news/"]');
  const publishedCount = await publishedLinks.count();
  await page.goto("/");
  const homepageNews = page.getByRole("heading", { name: "Useful advice from the workshop." });
  if (publishedCount === 0) await expect(homepageNews).toHaveCount(0);
  else await expect(homepageNews).toBeVisible();
});

test("News & Blog CMS is protected by admin authentication", async ({ page }) => {
  await page.goto("/admin/news");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin/news/new");
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
  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/admin/forgot-password");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("sobautofix@gmail.com", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/secure sign-in link/i)).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveValue("");
});

test("admin password recovery can be requested without exposing the authorised address", async ({ page }) => {
  await page.goto("/admin/forgot-password");
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByLabel("Admin email")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  await expect(page.getByText("sobautofix@gmail.com", { exact: true })).toHaveCount(0);
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
