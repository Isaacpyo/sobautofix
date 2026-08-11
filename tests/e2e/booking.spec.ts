import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type BookingService = {
  key: string;
  name: string;
  description: string;
  locationMode: "workshop" | "mobile" | "both";
};

type CreateBookingRequest = {
  vehicle?: { registration?: string; make?: string; model?: string };
  serviceKey?: string;
  location?: { mode?: string; address?: string; postcode?: string };
  customer?: { name?: string; email?: string; phone?: string };
  appointmentStart?: string;
  idempotencyKey?: string;
  conditionalAnswers?: {
    warningLight?: string;
    issueTiming?: string;
    vehicleAccessible?: string;
  };
};

const vehicle = {
  registration: "AB12CDE",
  make: "Vauxhall",
  model: "Astra",
  year: 2017,
  fuelType: "Petrol",
  transmission: "Manual",
  colour: "Blue",
};

const diagnosticService: BookingService = {
  key: "vehicle-diagnostics",
  name: "Vehicle Diagnostics",
  description: "System testing and fault investigation for warning lights and running concerns.",
  locationMode: "both",
};

const servicingService: BookingService = {
  key: "vehicle-servicing",
  name: "Vehicle Servicing",
  description: "Scheduled servicing and vehicle health checks at the SOB Autofix workshop.",
  locationMode: "workshop",
};

async function setEssentialCookies(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("sob-autofix-consent-v1", JSON.stringify({ analytics: false, functional: false }));
  });
}

async function seedConfirmedVehicle(page: Page) {
  await page.addInitScript((storedVehicle) => {
    sessionStorage.setItem("sob-autofix-vehicle-session", JSON.stringify({ vehicle: storedVehicle, vehicleConfirmed: true }));
  }, vehicle);
}

async function mockServices(page: Page, services: BookingService[] = [diagnosticService, servicingService]) {
  await page.route("**/api/bookings/services", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ services }),
  }));
}

async function mockVehicleLookup(page: Page, status = 200) {
  await page.route("**/api/vehicle/lookup", (route) => route.fulfill({
    status,
    contentType: "application/json",
    body: status === 200
      ? JSON.stringify({ success: true, vehicle })
      : JSON.stringify({ success: false, error: { code: "unavailable", message: "Vehicle lookup is unavailable." } }),
  }));
}

function futureDate(days = 7) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextDate(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function ukTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(new Date(value));
}

async function reachWorkshopAppointment(page: Page) {
  await page.goto("/book");
  await expect(page.getByText("Vauxhall Astra", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Vehicle Servicing/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: "Tell us what is happening" }).fill("The vehicle is due for its scheduled service and health check.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Bring vehicle to SOB Autofix", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Full name").fill("Test Customer");
  await page.getByLabel("Phone number").fill("07123 456789");
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Choose an appointment" })).toBeVisible();
}

test.describe("SOB Autofix booking wizard", () => {
  test("serves an accessible first-party booking page without an iframe", async ({ page }) => {
    await setEssentialCookies(page);
    await mockServices(page);

    const response = await page.goto("/book");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Book your vehicle in" })).toBeVisible();
    await expect(page.getByText("Step 1 of 7: Vehicle", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Vehicle registration")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });

  test("continues manually after lookup failure and shows service-aware questions", async ({ page }) => {
    await setEssentialCookies(page);
    await mockServices(page);
    await mockVehicleLookup(page, 503);
    await page.goto("/book");

    await page.getByLabel("Vehicle registration").fill("ab12 cde");
    await page.getByRole("button", { name: "Find vehicle" }).click();
    await expect(page.getByRole("heading", { name: "We couldn't load the vehicle details." })).toBeVisible();
    await page.getByRole("button", { name: "Enter vehicle manually" }).click();
    await expect(page.getByLabel("Vehicle registration")).toHaveValue("AB12CDE");
    await page.getByLabel("Make").fill("Vauxhall");
    await page.getByLabel("Model").fill("Astra");
    await page.getByRole("button", { name: /Continue with these details/ }).click();

    await page.getByRole("radio", { name: /Vehicle Servicing/ }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Current mileage (optional)")).toBeVisible();
    await expect(page.getByLabel(/Which warning light/)).toHaveCount(0);
  });

  test("creates only after explicit review confirmation and shows the SOB reference", async ({ page }) => {
    await setEssentialCookies(page);
    await mockServices(page);
    await mockVehicleLookup(page);
    const date = futureDate();
    const end = nextDate(date);
    const slotStart = `${date}T08:00:00.000Z`;
    let createCalls = 0;
    let slotRequest: Record<string, unknown> | undefined;
    let createRequest: CreateBookingRequest | undefined;

    await page.route("**/api/bookings/slots", async (route) => {
      slotRequest = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ slots: [{ start: slotStart }], timeZone: "Europe/London" }),
      });
    });
    await page.route("**/api/bookings", async (route) => {
      createCalls += 1;
      createRequest = route.request().postDataJSON() as CreateBookingRequest;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          booking: {
            reference: "SOB-482715",
            status: "confirmed",
            appointmentStart: slotStart,
            service: diagnosticService.name,
            vehicle: "Vauxhall Astra",
            location: "12 Test Street, Doncaster, DN1 1AA",
            email: "customer@example.com",
          },
        }),
      });
    });

    await page.goto("/book");
    await page.getByLabel("Vehicle registration").fill("AB12 CDE");
    await page.getByRole("button", { name: "Find vehicle" }).click();
    await expect(page.getByText("Vauxhall Astra", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Yes, this is my vehicle/ }).click();
    await page.getByRole("radio", { name: /Vehicle Diagnostics/ }).check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByLabel(/Which warning light/)).toBeVisible();
    await expect(page.getByLabel(/When does the issue happen/)).toBeVisible();
    await page.getByRole("textbox", { name: "Tell us what is happening" }).fill("The engine warning light appears intermittently while driving.");
    await page.getByLabel(/Which warning light/).fill("Engine management light");
    await page.getByLabel(/When does the issue happen/).selectOption("intermittently");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("radio", { name: /Mobile service/ }).check();
    await expect(page.getByLabel("Vehicle address")).toBeVisible();
    await page.getByLabel("Vehicle address").fill("12 Test Street, Doncaster");
    await page.getByLabel("Postcode").fill("DN1 1AA");
    await page.getByRole("radio", { name: "No / not sure" }).check();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Full name").fill("Test Customer");
    await page.getByLabel("Phone number").fill("+44 7123 456789");
    await page.getByLabel("Email address").fill("customer@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Appointment date").fill(date);
    await page.getByRole("button", { name: "Check available times" }).click();
    await page.getByRole("button", { name: ukTime(slotStart) }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Review your booking" })).toBeVisible();
    expect(createCalls).toBe(0);
    await expect(page.getByText("SOB-482715")).toHaveCount(0);
    await page.getByRole("button", { name: "Confirm booking" }).click();

    await expect(page.getByRole("heading", { name: "Booking confirmed" })).toBeVisible();
    await expect(page.getByText("SOB-482715")).toBeVisible();
    await expect(page.getByRole("link", { name: /Manage this booking/ })).toHaveAttribute("href", "/manage-booking");
    expect(createCalls).toBe(1);
    expect(slotRequest).toMatchObject({
      serviceKey: diagnosticService.key,
      locationMode: "mobile",
      start: date,
      end,
    });
    expect(createRequest).toMatchObject({
      vehicle: { registration: "AB12CDE", make: "Vauxhall", model: "Astra" },
      serviceKey: diagnosticService.key,
      location: { mode: "mobile", address: "12 Test Street, Doncaster", postcode: "DN1 1AA" },
      customer: { name: "Test Customer", email: "customer@example.com", phone: "+44 7123 456789" },
      appointmentStart: slotStart,
      conditionalAnswers: {
        warningLight: "Engine management light",
        issueTiming: "intermittently",
        vehicleAccessible: "no_or_unsure",
      },
    });
    expect(createRequest?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("shows outage and empty-availability recovery without fake time slots", async ({ page }) => {
    await setEssentialCookies(page);
    await seedConfirmedVehicle(page);
    await mockServices(page, [servicingService]);
    const date = futureDate();
    let availabilityCalls = 0;
    let createCalls = 0;

    await page.route("**/api/bookings/slots", (route) => {
      availabilityCalls += 1;
      return route.fulfill(availabilityCalls === 1 ? {
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "provider_unavailable", message: "Availability is unavailable." } }),
      } : {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ slots: [], timeZone: "Europe/London" }),
      });
    });
    await page.route("**/api/bookings", (route) => {
      createCalls += 1;
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "unexpected_create" } }) });
    });

    await reachWorkshopAppointment(page);
    await page.getByLabel("Appointment date").fill(date);
    await page.getByRole("button", { name: "Check available times" }).click();

    await expect(page.getByRole("heading", { name: /Online appointment availability is temporarily unavailable/ })).toBeVisible();
    await expect(page.locator("button[aria-pressed]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Send an enquiry" })).toHaveAttribute("href", "/get-a-quote");
    await expect(page.getByRole("link", { name: /Call 07469/ })).toHaveAttribute("href", /^tel:/);
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByRole("heading", { name: "No appointments on this date" })).toBeVisible();
    await expect(page.locator("button[aria-pressed]")).toHaveCount(0);
    expect(availabilityCalls).toBe(2);
    expect(createCalls).toBe(0);
  });

  test("has no horizontal overflow on a mobile booking journey", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile-project coverage");
    await setEssentialCookies(page);
    await seedConfirmedVehicle(page);
    await mockServices(page, [diagnosticService, servicingService]);
    await page.goto("/book");
    await expect(page.getByText("Vauxhall Astra", { exact: true })).toBeVisible();

    const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await expect.poll(overflow).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "What does your vehicle need?" })).toBeVisible();
    await expect.poll(overflow).toBeLessThanOrEqual(1);
  });
});
