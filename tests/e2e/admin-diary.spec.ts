import { expect, test, type Page } from "@playwright/test";

// Autofix Diary end to end against the local Supabase stack with demo staff
// (node scripts/exchange-local-seed.mjs). Needs E2E_ADMIN_EMAIL and
// E2E_ADMIN_PASSWORD; skipped otherwise, so CI without a database stays green.
// Never sends email: run the dev server with `env -u RESEND_API_KEY`.

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe.configure({ mode: "serial" });
test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (local staff login) to run the diary journey.");
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "Runs once, on desktop Chromium.");

// A quiet weekday well in the future, away from the clock changes, unique per run.
const runId = Date.now().toString(36);
const day = new Date(Date.UTC(2027, 4, 4 + Math.floor(Date.now() / 1000) % 400));
while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() + 1);
const date = day.toISOString().slice(0, 10);

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email as string);
  await page.getByLabel("Password").fill(password as string);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/admin/login"), { timeout: 60_000 });
}

/** Saves and, if an earlier run left something in the same slot, overrides the warning. */
async function saveExpectingNoClash(page: Page) {
  const warning = page.getByRole("alert").filter({ hasText: "Check before saving" });
  await Promise.race([page.waitForURL(/saved=created/, { timeout: 60_000 }), warning.waitFor({ timeout: 60_000 })]);
  if (await warning.isVisible()) {
    await warning.getByLabel("Reason for going ahead").fill("Left over from an earlier test run");
    await warning.getByRole("button", { name: /anyway/ }).click();
  }
  await page.waitForURL(/\/admin\/diary\/[0-9a-f-]{36}\?saved=created/);
  return page.url().split("?")[0] as string;
}

async function cancel(page: Page, url: string, reason: string) {
  await page.goto(url);
  await page.getByRole("button", { name: "Cancel appointment" }).click();
  await page.getByLabel("Reason for cancelling").fill(reason);
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await page.waitForURL(/saved=cancelled/);
}

async function createAppointment(page: Page, title: string, start: string, options: { kind?: string; status?: string } = {}) {
  await page.goto(`/admin/diary/new?start=${date}T${start}${options.kind ? `&kind=${options.kind}` : ""}`);
  await expect(page.getByRole("heading", { name: "New appointment" })).toBeVisible();
  if (options.status) await page.getByLabel("Status").selectOption({ label: options.status });
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Save appointment" }).click();
}

test("create, warn about a clash, override with a reason, reschedule and cancel", async ({ page }) => {
  await signIn(page);

  // First appointment: assigned to the signed-in staff member by default.
  await createAppointment(page, `E2E prep ${runId}`, "10:00", { kind: "preparation" });
  const prepUrl = await saveExpectingNoClash(page);
  await expect(page.getByRole("status").filter({ hasText: "Appointment saved." })).toBeVisible();

  // Second appointment, same person, overlapping time: warned, not blocked.
  await createAppointment(page, `E2E collection ${runId}`, "10:30", { kind: "collection" });
  const warning = page.getByRole("alert").filter({ hasText: "Check before saving" });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Same staff member");
  await expect(warning).toContainText(`E2E prep ${runId}`);
  // The form keeps what was typed.
  await expect(page.getByLabel("Title")).toHaveValue(`E2E collection ${runId}`);
  const saveAnyway = warning.getByRole("button", { name: "Save anyway" });
  await expect(saveAnyway).toBeDisabled();
  await warning.getByLabel("Reason for going ahead").fill("Two-person job, both needed");
  await saveAnyway.click();
  await page.waitForURL(/\/admin\/diary\/[0-9a-f-]{36}\?saved=created/);
  await expect(page.getByText("Saved despite a warning")).toBeVisible();
  await expect(page.getByText("Reason: Two-person job, both needed")).toBeVisible();

  // Reschedule to a free slot: no warning this time.
  await page.getByLabel("Start").fill("14:00");
  await page.getByLabel("End").fill("15:00");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/saved=updated/);
  await expect(page.getByText(/14:00 to 15:00/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByText(/^Rescheduled/).first()).toBeVisible();

  // The diary shows the moved appointment on its day.
  const detailUrl = page.url().split("?")[0] as string;
  await page.goto(`/admin/diary?view=day&date=${date}`);
  await expect(page.getByRole("link", { name: new RegExp(`E2E collection ${runId}`) }).first()).toBeVisible();

  // Cancel: a reason is required.
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Cancel appointment" }).click();
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  // An empty reason is refused before anything is sent.
  expect(await page.getByLabel("Reason for cancelling").evaluate((element) => (element as HTMLTextAreaElement).validity.valueMissing)).toBe(true);
  await expect(page).not.toHaveURL(/saved=cancelled/);
  await page.getByLabel("Reason for cancelling").fill("Auction moved the collection");
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await page.waitForURL(/saved=cancelled/);
  await expect(page.getByText("Reason: Auction moved the collection")).toBeVisible();
  await cancel(page, prepUrl, "End-to-end test clean-up");
});

test("a requested viewing is confirmed from Viewings & Appointments and the diary shows the same appointment", async ({ page }) => {
  await signIn(page);
  const title = `E2E viewing ${runId}`;
  await createAppointment(page, title, "16:00", { kind: "viewing", status: "Requested" });
  const appointmentUrl = await saveExpectingNoClash(page);
  await expect(page.getByText("Requested: not confirmed").or(page.getByText("Requested", { exact: true })).first()).toBeVisible();

  await page.goto("/admin/exchange/viewings");
  const card = page.getByRole("article", { name: title });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Confirm" }).click();
  // Either confirmed straight away, or warned about another viewing at the same time.
  const warning = card.getByRole("alert").filter({ hasText: "Check before saving" });
  const confirmed = page.getByRole("status").filter({ hasText: "Viewing confirmed." });
  await expect(warning.or(confirmed)).toBeVisible();
  if (await warning.isVisible()) {
    await warning.getByLabel("Reason for going ahead").fill("Customer agreed to share the slot");
    await warning.getByRole("button", { name: "Confirm anyway" }).click();
  }
  await expect(confirmed).toBeVisible();
  await expect(confirmed).toContainText("did not give an email address");
  await expect(page.getByRole("article", { name: title })).toHaveCount(0);
  // No customer email on this staff-created viewing, so nothing is sent.

  await page.goto(appointmentUrl);
  await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Viewing confirmed").first()).toBeVisible();

  // Tidy up so the request list stays clean.
  await cancel(page, appointmentUrl, "End-to-end test clean-up");
});
