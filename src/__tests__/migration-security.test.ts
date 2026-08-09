import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "202608080001_initial_schema.sql"), "utf8");
const exposedTables = [
  "admin_profiles", "site_settings", "content_entries", "content_revisions", "navigation_items", "offers", "service_prices", "media_assets", "reviews", "customers", "vehicles", "enquiries", "enquiry_attachments", "sale_vehicles", "sale_vehicle_images", "notification_attempts", "rate_limit_buckets", "admin_audit_log",
];

describe("Supabase migration security invariants", () => {
  it.each(exposedTables)("enables RLS on %s", (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security;`);
  });

  it("keeps public writes behind server endpoints", () => {
    expect(migration).not.toMatch(/create policy[^;]+for insert to anon/i);
    expect(migration).not.toMatch(/create policy[^;]+for update to anon/i);
  });

  it("uses separate public, vehicle-sale and private buckets", () => {
    expect(migration).toContain("'public-media'");
    expect(migration).toContain("'vehicle-sales'");
    expect(migration).toContain("'enquiry-attachments'");
    expect(migration).toContain("'enquiry-attachments', false");
  });

  it("limits rate-limit and retention functions to the service role", () => {
    expect(migration).toContain("grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;");
    expect(migration).toContain("grant execute on function public.apply_enquiry_retention() to service_role;");
  });
});
