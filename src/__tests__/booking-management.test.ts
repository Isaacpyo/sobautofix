import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBookingAccessToken, verifyBookingAccessToken } from "@/lib/bookings/access-token";
import { bookingLookupSchema, createBookingSchema } from "@/lib/bookings/schema";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

function filesUnder(directory: string): string[] {
  const absolute = join(root, directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(absolute, entry.name);
    return entry.isDirectory() ? filesUnder(relative(root, path)) : [relative(root, path)];
  });
}

describe("provider-neutral booking management", () => {
  beforeEach(() => {
    process.env.BOOKING_MANAGEMENT_SECRET = "booking-management-test-secret-with-enough-entropy";
  });

  afterEach(() => {
    delete process.env.BOOKING_MANAGEMENT_SECRET;
  });

  it("requires reference, registration and email for a booking lookup", () => {
    expect(bookingLookupSchema.safeParse({ bookingReference: "SOB-123456", registration: "AB12 CDE" }).success).toBe(false);
  });

  it("normalises every secure lookup factor", () => {
    expect(bookingLookupSchema.parse({ bookingReference: " sob-123456 ", registration: "ab12 cde", email: " TEST@Example.COM " })).toEqual({
      bookingReference: "SOB-123456",
      registration: "AB12CDE",
      email: "test@example.com",
    });
  });

  it("issues a valid short-lived booking access token", () => {
    const token = createBookingAccessToken("booking-id", 60);
    expect(verifyBookingAccessToken(token)).toMatchObject({ bookingId: "booking-id" });
  });

  it("rejects a tampered booking access token", () => {
    const token = createBookingAccessToken("booking-id", 60);
    expect(verifyBookingAccessToken(`${token}x`)).toBeNull();
  });

  it("rejects an expired booking access token", () => {
    expect(verifyBookingAccessToken(createBookingAccessToken("booking-id", -1))).toBeNull();
  });

  it("keeps non-sequential collision-checked SOB references", () => {
    const migration = read("supabase", "migrations", "202608110002_booking_management.sql");
    expect(migration).toContain("floor(random() * 1000000)");
    expect(migration).toContain("exit when not exists");
    expect(migration).toContain("^SOB-[0-9]{6}$");
  });

  it("adds provider-neutral booking correlation and sync fields", () => {
    const migration = read("supabase", "migrations", "202608110006_calcom_booking_rework.sql");
    expect(migration).toContain("provider_booking_uid text");
    expect(migration).toContain("provider_event_type_id bigint");
    expect(migration).toContain("provider_sync_state");
  });

  it("reserves booking creation through an idempotent database function", () => {
    const migration = read("supabase", "migrations", "202608110006_calcom_booking_rework.sql");
    expect(migration).toContain("create_booking_intent");
    expect(migration).toContain("idempotency_key");
    expect(migration).toContain("IDEMPOTENCY_KEY_REQUIRED");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("when unique_violation");
  });

  it("ships service mappings disabled until real event types are configured", () => {
    const migration = read("supabase", "migrations", "202608110006_calcom_booking_rework.sql");
    expect(migration).toContain("online_booking_enabled boolean not null default false");
    expect(migration).toContain("not online_booking_enabled or provider_event_type_id is not null");
    expect(migration).toContain("provider_event_type_id > 0");
    expect(migration).not.toMatch(/provider_event_type_id\s*,?\s*\)\s*values[\s\S]{0,400}\b\d{2,}\b/i);
  });

  it("validates complete server-side booking data", () => {
    const result = createBookingSchema.safeParse({
      vehicle: { registration: "AB12 CDE", make: "Vauxhall", model: "Astra" },
      serviceKey: "vehicle-diagnostics",
      problemDescription: "The warning light appears intermittently.",
      symptoms: ["warning light"],
      conditionalAnswers: { warningLight: "Engine management" },
      location: { mode: "workshop" },
      customer: { name: "Test Customer", email: "test@example.com", phone: "07000 000000" },
      appointmentStart: "2026-08-18T09:00:00.000Z",
      idempotencyKey: "70ca0b0b-1df7-42f4-8fe1-329c54ace42d",
    });
    expect(result.success).toBe(true);
  });

  it("requires a mobile address and postcode only for mobile work", () => {
    const base = {
      vehicle: { registration: "AB12 CDE" },
      serviceKey: "mobile-diagnostic-visit",
      problemDescription: "The vehicle will not start consistently.",
      symptoms: [],
      conditionalAnswers: {},
      customer: { name: "Test Customer", email: "test@example.com", phone: "07000 000000" },
      appointmentStart: "2026-08-18T09:00:00.000Z",
      idempotencyKey: "70ca0b0b-1df7-42f4-8fe1-329c54ace42d",
    };
    expect(createBookingSchema.safeParse({ ...base, location: { mode: "mobile" } }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...base, location: { mode: "mobile", address: "1 Station Road", postcode: "DN6 9HF" } }).success).toBe(true);
  });

  it("keeps rescheduling and cancellation inside the product", () => {
    const actions = read("src", "app", "manage-booking", "actions.ts");
    const component = read("src", "components", "booking", "manage-booking.tsx");
    expect(actions).toContain("getBookingRescheduleSlots");
    expect(actions).toContain("rescheduleBooking");
    expect(actions).toContain("cancelBooking");
    expect(component).not.toContain("window.location");
  });

  it("rate-limits lookup, slot browsing, reschedule and cancellation separately", () => {
    const actions = read("src", "app", "manage-booking", "actions.ts");
    expect(actions).toContain("booking_lookup_ip");
    expect(actions).toContain("booking_reschedule_slots");
    expect(actions).toContain('"booking_reschedule"');
    expect(actions).toContain("booking_cancel");
  });

  it("preserves history and hides provider identifiers from the customer view", () => {
    const component = read("src", "components", "booking", "manage-booking.tsx");
    expect(component).toContain("Booking history");
    expect(component).toContain("booking.history");
    expect(component).not.toContain("provider_booking_uid");
    expect(component).not.toContain("eventTypeId");
  });

  it("rejects reintroduced legacy scheduling integration outside compatibility migrations", () => {
    const legacyName = ["calen", "dly"].join("");
    const forbidden = new RegExp(`${legacyName}|${legacyName}\\.com|${legacyName.toUpperCase()}_`, "i");
    const historicalMigrations = new Set([
      join("supabase", "migrations", "202608110002_booking_management.sql"),
      join("supabase", "migrations", "202608110006_calcom_booking_rework.sql"),
    ]);
    const candidates = [
      ...filesUnder("src"),
      ...filesUnder("docs"),
      ".env.example",
      "README.md",
      "next.config.ts",
      "package.json",
      "pnpm-lock.yaml",
    ].filter((file) => !historicalMigrations.has(file) && file !== join("src", "__tests__", "booking-management.test.ts"));
    const matches = candidates.filter((file) => forbidden.test(readFileSync(join(root, file), "utf8")));
    expect(matches).toEqual([]);
  });
});
