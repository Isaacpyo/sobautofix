import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requiredBookingVariables, requiredProductionVariables } from "@/lib/env";

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
    expect(requiredProductionVariables).toContain("ENQUIRY_REPLY_DOMAIN");
    expect(requiredProductionVariables).toContain("RESEND_WEBHOOK_SECRET");
    expect(requiredProductionVariables).toContain("CLOUDFLARE_EMAIL_WEBHOOK_SECRET");
    expect(requiredProductionVariables).not.toContain("RESEND_INBOUND_DOMAIN");
    expect(envExample).toContain("ENQUIRY_REPLY_DOMAIN=reply.sobautofix.com");
  });

  it("does not make safe-fallback integrations production blockers", () => {
    expect(requiredProductionVariables).not.toContain("DVLA_API_KEY");
    expect(requiredProductionVariables).not.toContain("VEHICLE_DATA_GLOBAL_API_KEY");
    expect(requiredProductionVariables).not.toContain("NEXT_PUBLIC_GA_MEASUREMENT_ID");
    expect(requiredProductionVariables).not.toContain("SENTRY_DSN");
  });

  it("keeps booking credentials server-only and separately degradable", () => {
    expect(requiredBookingVariables).toEqual(["CALCOM_API_KEY", "CALCOM_WEBHOOK_SECRET", "CALCOM_DEFAULT_TIMEZONE", "BOOKING_MANAGEMENT_SECRET"]);
    for (const name of requiredBookingVariables) {
      expect(envExample).toContain(`${name}=`);
      expect(name).not.toMatch(/^NEXT_PUBLIC_/);
      expect(requiredProductionVariables).not.toContain(name);
    }
  });

  it("documents the Vehicle Data Global integration without exposing a key", () => {
    expect(envExample).toContain("VEHICLE_LOOKUP_PROVIDER=vehicle-data-global");
    expect(envExample).toContain("VEHICLE_DATA_GLOBAL_API_KEY=");
    expect(envExample).toContain("VEHICLE_DATA_GLOBAL_BASE_URL=https://uk.api.vehicledataglobal.com");
    expect(envExample).toContain("VEHICLE_DATA_GLOBAL_PACKAGE=VehicleDetails");
  });
});
