import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL } from "@/config/admin";

const enquiryIds = (process.env.E2E_ADMIN_ENQUIRY_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

test("enquiry inbox opens existing enquiry threads and keeps missing IDs as 404", async ({ page, isMobile }) => {
  test.skip(!supabaseUrl || !supabaseSecretKey || !enquiryIds.length, "Authenticated enquiry fixtures are not configured");

  const admin = createClient(supabaseUrl!, supabaseSecretKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: ADMIN_EMAIL });
  expect(error).toBeNull();
  const tokenHash = data.properties?.hashed_token;
  expect(tokenHash).toBeTruthy();
  if (!tokenHash) throw new Error("Supabase did not generate an admin authentication token");

  await page.goto(`/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=/admin/enquiries`);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/enquiries");

  for (const enquiryId of enquiryIds) {
    const candidates = page.locator(`a[href="/admin/enquiries/${enquiryId}"]:visible`);
    const openLink = isMobile ? candidates.first() : candidates.filter({ hasText: /^Open$/ }).first();
    await expect(openLink).toBeVisible();
    await openLink.click();
    await expect(page).toHaveURL(new RegExp(`/admin/enquiries/${enquiryId}$`));
    await expect(page.getByRole("heading", { name: "Conversation" })).toBeVisible();
    await page.goto("/admin/enquiries");
  }

  const missingId = "00000000-0000-4000-8000-000000000000";
  await page.goto(`/admin/enquiries/${missingId}`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
});
