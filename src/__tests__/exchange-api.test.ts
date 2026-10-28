import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSellerSubmissionPayload, buildVehicleEnquiryPayload, mapRpcError } from "@/lib/exchange/public/payloads";
import { sellerSubmissionRequestSchema, vehicleEnquiryRequestSchema } from "@/lib/exchange/public/schemas";
import { createSellerUploadToken, verifySellerUploadToken } from "@/lib/exchange/public/upload-token";
import { createUploadToken } from "@/lib/enquiries/upload-token";

const submitVehicleEnquiry = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn(async (token?: string) => token === "ok") }));
vi.mock("@/lib/exchange/public/enquiry-service", async () => {
  class ExchangeServiceError extends Error {
    constructor(readonly code: string, message: string, readonly fields?: Record<string, string[]>, readonly similar?: unknown[], readonly currentStatus?: string) {
      super(message);
    }
  }
  return { ExchangeServiceError, submitVehicleEnquiry: (...args: unknown[]) => submitVehicleEnquiry(...args) };
});

const vehicleId = "0b0f3c55-9a43-4a64-8f2a-7f0d3a0d4b11";
const key = "5c7f6d0a-3d84-4d6f-9b8e-2b9a1e6c1a22";
const viewing = {
  idempotencyKey: key, vehicleId, intent: "viewing", name: "Alex Buyer", phone: "07000 000123", email: "", preferredContact: "phone",
  preferredDate: "2026-10-31", preferredTime: "11:00", alternativeDate: "", alternativeTime: "", message: "", privacyAccepted: true, turnstileToken: "ok",
};

function post(body: unknown) {
  return new NextRequest("http://localhost/api/exchange/vehicle-enquiries", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5" } });
}

describe("vehicle enquiry validation", () => {
  it("accepts a viewing request and a question", () => {
    expect(vehicleEnquiryRequestSchema.safeParse(viewing).success).toBe(true);
    expect(vehicleEnquiryRequestSchema.safeParse({ ...viewing, intent: "question", preferredDate: "", preferredTime: "", message: "Two keys?" }).success).toBe(true);
  });

  it("requires a time for viewings, a message for questions, and email when email is preferred", () => {
    const issues = (input: object) => vehicleEnquiryRequestSchema.safeParse(input).error?.issues.map((issue) => issue.path.join("."));
    expect(issues({ ...viewing, preferredTime: "" })).toContain("preferredTime");
    expect(issues({ ...viewing, intent: "question" })).toContain("message");
    expect(issues({ ...viewing, preferredContact: "email" })).toContain("email");
    expect(issues({ ...viewing, alternativeDate: "2026-11-02" })).toContain("alternativeTime");
    expect(issues({ ...viewing, privacyAccepted: false })).toContain("privacyAccepted");
    expect(issues({ ...viewing, preferredTime: "23:00" })).toContain("preferredTime");
  });
});

describe("POST /api/exchange/vehicle-enquiries", () => {
  beforeEach(() => submitVehicleEnquiry.mockReset());

  it("returns field errors and never calls the service for invalid input", async () => {
    const { POST } = await import("@/app/api/exchange/vehicle-enquiries/route");
    const response = await POST(post({ ...viewing, name: "" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.fields.name).toBeTruthy();
    expect(submitVehicleEnquiry).not.toHaveBeenCalled();
  });

  it("rejects a failed security check", async () => {
    const { POST } = await import("@/app/api/exchange/vehicle-enquiries/route");
    const response = await POST(post({ ...viewing, turnstileToken: "bad" }));
    expect(response.status).toBe(403);
  });

  it("returns 201 for a new request and 200 for a repeated idempotency key", async () => {
    const { POST } = await import("@/app/api/exchange/vehicle-enquiries/route");
    submitVehicleEnquiry.mockResolvedValueOnce({ enquiryId: "e1", created: true, requestedStart: "2026-10-31T11:00:00.000Z", notificationStatus: "sent" });
    expect((await POST(post(viewing))).status).toBe(201);
    submitVehicleEnquiry.mockResolvedValueOnce({ enquiryId: "e1", created: false, requestedStart: "2026-10-31T11:00:00.000Z", notificationStatus: "skipped" });
    const repeat = await POST(post(viewing));
    expect(repeat.status).toBe(200);
    expect((await repeat.json()).enquiryId).toBe("e1");
  });

  it("maps an unavailable car to 409 with similar cars and the current status", async () => {
    const { POST } = await import("@/app/api/exchange/vehicle-enquiries/route");
    const { ExchangeServiceError } = await import("@/lib/exchange/public/enquiry-service");
    submitVehicleEnquiry.mockRejectedValueOnce(new ExchangeServiceError("VEHICLE_UNAVAILABLE", "Reserved", undefined, [{ slug: "demo-astra", year: 2017, make: "Vauxhall", model: "Astra", price: 6750 }], "reserved"));
    const response = await POST(post(viewing));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, currentStatus: "reserved", error: { code: "VEHICLE_UNAVAILABLE" }, similar: [{ slug: "demo-astra", name: "2017 Vauxhall Astra", price: 6750 }] });
  });

  it("answers 503 calmly when the database update is missing, without leaking errors", async () => {
    const { POST } = await import("@/app/api/exchange/vehicle-enquiries/route");
    const { ExchangeServiceError } = await import("@/lib/exchange/public/enquiry-service");
    submitVehicleEnquiry.mockRejectedValueOnce(new ExchangeServiceError("SCHEMA_MISSING", "relation does not exist"));
    const response = await POST(post(viewing));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("relation");
  });
});

describe("RPC payloads", () => {
  const vehicle = { id: vehicleId, year: 2019, make: "Ford", model: "Focus", derivative: "1.0 Zetec", stockReference: "STK-1" };

  it("maps a viewing to create_vehicle_enquiry keys with UTC instants", () => {
    const parsed = vehicleEnquiryRequestSchema.parse({ ...viewing, message: "Saturday morning ideal" });
    const payload = buildVehicleEnquiryPayload(parsed, vehicle, { start: new Date("2026-10-31T11:00:00Z") }, 45);
    expect(payload).toMatchObject({ idempotencyKey: key, intent: "viewing", vehicleId, name: "Alex Buyer", phone: "07000 000123", preferredContact: "phone", preferredStart: "2026-10-31T11:00:00.000Z", durationMinutes: 45, message: "Saturday morning ideal" });
    expect(payload.description).toContain("awaiting staff confirmation");
    expect(payload.description).toContain("STK-1");
  });

  it("keeps the registration and free-text condition notes out of the seller enquiry description", () => {
    const request = sellerSubmissionRequestSchema.parse({
      idempotencyKey: key,
      vehicle: { registration: "ab12 cde", lookupSource: "manual", make: "Peugeot", model: "208", year: "2016", mileage: "64,500" },
      condition: { runningStatus: "runs_and_drives", knownFaults: "Clutch slips", damage: "Dent", motStatus: "expired", motExpiry: "2027-01-01", serviceHistory: "partial", outstandingFinance: "no" },
      contact: { name: "Sam Seller", phone: "07000 000456", email: "", postcode: "dn6 9hf", preferredContact: "phone", marketingConsent: false },
      privacyAccepted: true,
      photoCount: 2,
    });
    expect(request.vehicle.registration).toBe("AB12CDE");
    expect(request.vehicle.mileage).toBe(64500);
    const payload = buildSellerSubmissionPayload(request, null);
    expect(payload).toMatchObject({ kind: "sell", registration: "AB12CDE", knownFaults: "Clutch slips", motExpiry: "", postcode: "DN6 9HF", marketingConsent: false });
    expect(payload.description).not.toContain("AB12CDE");
    expect(payload.description).not.toContain("Clutch slips");
    expect(buildSellerSubmissionPayload(request, vehicle).kind).toBe("part_exchange");
  });

  it("rejects an empty mileage instead of treating it as zero", () => {
    const result = sellerSubmissionRequestSchema.safeParse({ idempotencyKey: key, vehicle: { registration: "AB12CDE", lookupSource: "manual", make: "Ford", model: "Ka", year: "2015", mileage: "" }, condition: { runningStatus: "not_sure", motStatus: "not_sure", serviceHistory: "not_sure", outstandingFinance: "not_sure" }, contact: { name: "Sam", phone: "07000000456", postcode: "DN6 9HF", preferredContact: "phone" }, privacyAccepted: true });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("vehicle.mileage");
  });

  it("maps database errors to public outcomes", () => {
    expect(mapRpcError({ code: "P0001", message: "VEHICLE_UNAVAILABLE" })).toBe("VEHICLE_UNAVAILABLE");
    expect(mapRpcError({ code: "PGRST202", message: "function not found" })).toBe("SCHEMA_MISSING");
    expect(mapRpcError({ code: "23505", message: "duplicate" })).toBe("FAILED");
  });
});

describe("seller upload tokens", () => {
  const id = "9a1f7c2e-1b2c-4d3e-8f90-1234567890ab";
  it("verifies for the right submission until expiry", () => {
    const token = createSellerUploadToken(id);
    expect(verifySellerUploadToken(token, id)).toBe(true);
    expect(verifySellerUploadToken(token, "other")).toBe(false);
    expect(verifySellerUploadToken(token, id, Date.now() + 3 * 60 * 60 * 1000)).toBe(false);
    expect(verifySellerUploadToken(`${token}x`, id)).toBe(false);
  });

  it("does not accept an enquiry attachment token", () => {
    expect(verifySellerUploadToken(createUploadToken(id), id)).toBe(false);
  });
});
