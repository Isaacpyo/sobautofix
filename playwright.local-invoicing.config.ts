import { defineConfig, devices } from "@playwright/test";
import { getLocalSupabaseConfig } from "./tests/helpers/local-supabase";

const supabase = getLocalSupabaseConfig();
const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/integration",
  testMatch: "invoice-pdf.playwright.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
      SUPABASE_SECRET_KEY: supabase.secretKey,
      PLAYWRIGHT_TEST: "true",
      PLAYWRIGHT_LOCAL_INVOICING: "true",
      VEHICLE_LOOKUP_PROVIDER: "mock",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
    },
  },
  projects: [{ name: "local-invoicing-chromium", use: { ...devices["Desktop Chrome"] } }],
});
