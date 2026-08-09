import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requiredProductionVariables } from "@/lib/env";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons?: Array<{ path: string; schedule: string }> };
const envExample = readFileSync(".env.example", "utf8");

describe("production deployment configuration", () => {
  it("uses only a daily retention cron on Vercel Hobby", () => {
    expect(vercel.crons).toEqual([{ path: "/api/cron/retention", schedule: "15 3 * * *" }]);
  });

  it("uses the Supabase secret-key contract without the legacy variable", () => {
    expect(envExample).toContain("SUPABASE_SECRET_KEY=");
    expect(envExample).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(requiredProductionVariables).toContain("SUPABASE_SECRET_KEY");
  });

  it("does not make safe-fallback integrations production blockers", () => {
    expect(requiredProductionVariables).not.toContain("DVLA_API_KEY");
    expect(requiredProductionVariables).not.toContain("NEXT_PUBLIC_CALENDLY_URL");
    expect(requiredProductionVariables).not.toContain("NEXT_PUBLIC_GA_MEASUREMENT_ID");
    expect(requiredProductionVariables).not.toContain("SENTRY_DSN");
  });
});
