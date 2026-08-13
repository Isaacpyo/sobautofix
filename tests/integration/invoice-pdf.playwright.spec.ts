import { expect, test } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import {
  getLocalSupabaseConfig,
  invoiceDraftPayload,
  localAdminEmail,
  localTestPassword,
  provisionLocalTestUsers,
  type LocalTestUsers,
} from "../helpers/local-supabase";

const appOrigin = "http://127.0.0.1:3100";
let users: LocalTestUsers;
let invoiceId: string;

test.beforeAll(async () => {
  users = await provisionLocalTestUsers();
  const draft = await users.admin.rpc("save_invoice_draft", {
    p_invoice_id: null,
    p_payload: invoiceDraftPayload("2087-08-11", "pdf-access"),
    p_confirm_duplicate_source: false,
  });
  if (draft.error || !draft.data) throw new Error(`Could not create PDF fixture: ${draft.error?.message}`);
  invoiceId = String(draft.data);

  const issued = await users.admin.rpc("issue_invoice", { p_invoice_id: invoiceId });
  if (issued.error) throw new Error(`Could not issue PDF fixture: ${issued.error.message}`);
});

test("an authenticated admin receives a private PDF document", async ({ context, page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(localAdminEmail);
  await page.getByLabel("Password").fill(localTestPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin(?:\/)?$/);

  const response = await context.request.get(`${appOrigin}/api/admin/invoices/${invoiceId}/pdf`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.headers()["content-disposition"]).toContain("attachment");
  expect(response.headers()["cache-control"]).toContain("private");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("a signed-in non-admin is denied the PDF", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    await context.addCookies(await sessionCookies(users.nonAdminIdentity.email));
    const response = await context.request.get(`${appOrigin}/api/admin/invoices/${invoiceId}/pdf`);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  } finally {
    await context.close();
  }
});

test("an anonymous caller is denied the PDF", async ({ request }) => {
  const response = await request.get(`${appOrigin}/api/admin/invoices/${invoiceId}/pdf`);
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
});

async function sessionCookies(email: string) {
  const { url, publishableKey } = getLocalSupabaseConfig();
  const jar = new Map<string, string>();
  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const cookie of cookies) {
          if (cookie.options.maxAge === 0) jar.delete(cookie.name);
          else jar.set(cookie.name, cookie.value);
        }
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: localTestPassword });
  if (error || !data.session || data.user.email !== email) {
    throw new Error(`Could not create local non-admin browser session: ${error?.message ?? "invalid session"}`);
  }
  if (jar.size === 0) throw new Error("Local non-admin sign-in did not persist an SSR session cookie.");
  return Array.from(jar, ([name, value]) => ({ name, value, url: appOrigin }));
}
