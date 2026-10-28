import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Database-level access checks for SOB Auto Exchange, against the LOCAL
// Supabase stack only (refuses any other host). Uses the demo staff logins
// from scripts/exchange-local-seed.mjs: sobautofix@gmail.com (owner) and
// temitopeagbola@gmail.com (sales). Creates one throwaway non-staff user and
// one throwaway private file, and removes both afterwards. Run with:
//   pnpm exec vitest run --config vitest.integration.config.ts tests/integration/exchange-access.test.ts

const LOCAL_PASSWORD = "Local-only-9f2e7c4a!";

function localConfig() {
  const fromFile: Record<string, string> = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const index = line.indexOf("=");
      if (index > 0 && !line.startsWith("#")) fromFile[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
  }
  const read = (...names: string[]) => names.map((name) => process.env[name] || fromFile[name]).find(Boolean);
  const url = read("INTEGRATION_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const publishable = read("INTEGRATION_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secret = read("INTEGRATION_SUPABASE_SECRET_KEY", "SUPABASE_SECRET_KEY");
  if (!url || !publishable || !secret) return null;
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.port !== "54321") return null;
  return { url: parsed.origin, publishable, secret };
}

const config = localConfig();
const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };

async function signedIn(email: string, password: string) {
  const client = createClient(config!.url, config!.publishable, options);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Local sign-in failed for ${email}: ${error.message}`);
  return client;
}

const privateTables = [
  "vehicle_internal_records", "vehicle_costs", "vehicle_prep_items", "seller_submissions", "seller_submission_photos",
  "vehicle_inspections", "vehicle_documents", "vehicle_sales", "diary_appointments", "exchange_private_settings",
  "seller_offers", "enquiries", "customers", "bookings", "notification_attempts", "admin_audit_log",
];

describe.skipIf(!config).sequential("exchange access on the local database", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let owner: SupabaseClient;
  let sales: SupabaseClient;
  let outsider: SupabaseClient;
  let outsiderId: string | null = null;
  const filePath = `integration-tests/${randomUUID()}.pdf`;

  beforeAll(async () => {
    service = createClient(config!.url, config!.secret, options);
    anon = createClient(config!.url, config!.publishable, options);
    owner = await signedIn("sobautofix@gmail.com", LOCAL_PASSWORD);
    sales = await signedIn("temitopeagbola@gmail.com", LOCAL_PASSWORD);
    const email = `exchange-outsider-${randomUUID().slice(0, 8)}@example.test`;
    const password = `Outsider-${randomUUID()}`;
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(created.error?.message);
    outsiderId = created.data.user.id;
    outsider = await signedIn(email, password);
    const upload = await service.storage.from("vehicle-documents").upload(filePath, Buffer.from("%PDF-1.4\n% integration test\n"), { contentType: "application/pdf" });
    if (upload.error) throw new Error(upload.error.message);
  });

  afterAll(async () => {
    await service?.storage.from("vehicle-documents").remove([filePath]);
    if (outsiderId) await service.auth.admin.deleteUser(outsiderId);
  });

  it("gives the anon key nothing from any private table", async () => {
    for (const table of privateTables) {
      const { data, error } = await anon.from(table).select("*").limit(1);
      expect(error ? true : (data ?? []).length === 0, `${table}: ${error?.code ?? "no error"}`).toBe(true);
    }
  });

  it("gives a signed-in non-staff user nothing from any private table", async () => {
    for (const table of privateTables) {
      const { data, error } = await outsider.from(table).select("*").limit(1);
      expect(error ? true : (data ?? []).length === 0, table).toBe(true);
    }
  });

  it("does not let the anon key write diary, enquiry or stock records", async () => {
    const appointment = await anon.from("diary_appointments").insert({ kind: "viewing", title: "x", starts_at: "2030-01-01T10:00:00Z", ends_at: "2030-01-01T11:00:00Z" });
    expect(appointment.error).not.toBeNull();
    const enquiry = await anon.from("enquiries").insert({ type: "vehicle_sales", customer_id: randomUUID() });
    expect(enquiry.error).not.toBeNull();
    const stock = await anon.from("sale_vehicles").update({ price: 1 }).neq("id", randomUUID()).select("id");
    expect(stock.error ? true : (stock.data ?? []).length === 0).toBe(true);
  });

  it("keeps the public submission functions for the server only", async () => {
    const enquiry = await anon.rpc("create_vehicle_enquiry", { p_payload: { idempotencyKey: randomUUID(), intent: "question" } });
    expect(enquiry.error).not.toBeNull();
    const seller = await anon.rpc("create_seller_submission", { p_payload: { idempotencyKey: randomUUID() } });
    expect(seller.error).not.toBeNull();
  });

  it("shows visitors only listed stock", async () => {
    const { data, error } = await anon.from("sale_vehicles").select("status").limit(500);
    expect(error).toBeNull();
    for (const row of data ?? []) expect(["available", "reserved", "sold"]).toContain(row.status);
  });

  it("keeps both private buckets private and unreadable without a staff session", async () => {
    for (const bucket of ["vehicle-documents", "seller-submission-photos"]) {
      const { data } = await service.storage.getBucket(bucket);
      expect(data?.public, bucket).toBe(false);
    }
    const anonDownload = await anon.storage.from("vehicle-documents").download(filePath);
    expect(anonDownload.error).not.toBeNull();
    const outsiderDownload = await outsider.storage.from("vehicle-documents").download(filePath);
    expect(outsiderDownload.error).not.toBeNull();
    const publicUrl = anon.storage.from("vehicle-documents").getPublicUrl(filePath).data.publicUrl;
    expect((await fetch(publicUrl)).ok).toBe(false);
  });

  it("issues short-lived signed links that stop working when they expire", async () => {
    const { data, error } = await service.storage.from("vehicle-documents").createSignedUrl(filePath, 1);
    expect(error).toBeNull();
    expect((await fetch(data!.signedUrl)).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    expect((await fetch(data!.signedUrl)).ok).toBe(false);
  });

  it("keeps costs, acquisition records and private settings from sales staff", async () => {
    for (const table of ["vehicle_costs", "vehicle_internal_records", "exchange_private_settings"]) {
      const { data, error } = await sales.from(table).select("*").limit(5);
      expect(error ? true : (data ?? []).length === 0, table).toBe(true);
    }
    const insert = await sales.from("vehicle_costs").insert({ sale_vehicle_id: randomUUID(), category: "parts", description: "x", amount_pence: 1 });
    expect(insert.error).not.toBeNull();
    const settings = await sales.from("exchange_settings").update({ value: { name: "Changed by sales" } }).eq("id", true).select("id");
    expect(settings.error ? true : (settings.data ?? []).length === 0).toBe(true);
  });

  it("lets the owner read costs (finance roles) and every staff member use the diary", async () => {
    const costs = await owner.from("vehicle_costs").select("id").limit(1);
    expect(costs.error).toBeNull();
    const diary = await sales.from("diary_appointments").select("id").limit(1);
    expect(diary.error).toBeNull();
  });
});
