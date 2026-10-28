import { describe, expect, it } from "vitest";
import { effectiveOfferStatus, submissionTransitionProblem } from "@/lib/exchange/admin/buying";
import { londonLocalToIso } from "@/lib/exchange/admin/core";
import { checklistComplete, checklistFromSettings, defaultReservationExpiry } from "@/lib/exchange/admin/handover";
import { salesStageProblem } from "@/lib/exchange/admin/sales";
import { permissionForStatusChange, statusChangeColumns, statusChangeProblem } from "@/lib/exchange/admin/stock-rules";
import { sniffContentType } from "@/lib/exchange/admin/uploads";
import { can, type StaffRole } from "@/lib/exchange/permissions";

const ready = { ready: true, checks: [], missing: [] };
const notReady = { ready: false, checks: [], missing: ["At least 4 photographs"] };
const as = (role: StaffRole) => (permission: Parameters<typeof can>[1]) => can(role, permission);
const base = { hasActiveSale: false, hasCompletedSale: false };

describe("stock status rules", () => {
  it("lets owners and managers publish a ready vehicle", () => {
    expect(statusChangeProblem({ from: "preparation", to: "available", can: as("owner"), readiness: ready, ...base })).toBeNull();
    expect(statusChangeProblem({ from: "preparation", to: "available", can: as("manager"), readiness: ready, ...base })).toBeNull();
  });

  it("blocks publishing until the checklist is complete", () => {
    expect(statusChangeProblem({ from: "draft", to: "available", can: as("owner"), readiness: notReady, ...base })).toMatch(/Finish the publishing checklist first: At least 4 photographs/);
  });

  it("stops sales and workshop staff publishing, withdrawing or marking sold", () => {
    for (const role of ["sales", "workshop"] as const) {
      expect(statusChangeProblem({ from: "preparation", to: "available", can: as(role), readiness: ready, ...base })).toMatch(/owner or manager/);
      expect(statusChangeProblem({ from: "available", to: "sold", can: as(role), readiness: ready, ...base })).toMatch(/owner or manager/);
      expect(statusChangeProblem({ from: "available", to: "archived", can: as(role), readiness: ready, ...base })).toMatch(/owner or manager/);
    }
  });

  it("lets stock and preparation staff move drafts in and out of preparation", () => {
    expect(permissionForStatusChange("draft", "preparation")).toBe("stock.edit");
    expect(statusChangeProblem({ from: "draft", to: "preparation", can: as("sales"), readiness: notReady, ...base })).toBeNull();
    expect(statusChangeProblem({ from: "preparation", to: "draft", can: as("workshop"), readiness: notReady, ...base })).toBeNull();
  });

  it("sends reservations and completed sales through Sales & Handover", () => {
    expect(statusChangeProblem({ from: "available", to: "reserved", can: as("owner"), readiness: ready, ...base })).toMatch(/Reserve a vehicle from its sales enquiry/);
    expect(statusChangeProblem({ from: "reserved", to: "available", can: as("owner"), readiness: ready, hasActiveSale: true, hasCompletedSale: false })).toMatch(/active reservation/);
    expect(statusChangeProblem({ from: "reserved", to: "sold", can: as("owner"), readiness: ready, hasActiveSale: true, hasCompletedSale: false })).toMatch(/active reservation|Complete the sale/);
    expect(statusChangeProblem({ from: "sold", to: "available", can: as("owner"), readiness: ready, hasActiveSale: false, hasCompletedSale: true })).toMatch(/completed sale record/);
    expect(statusChangeProblem({ from: "available", to: "archived", can: as("owner"), readiness: ready, hasActiveSale: true, hasCompletedSale: false })).toMatch(/Cancel the active reservation/);
  });

  it("keeps the legacy sold toggle working for vehicles without a sale record", () => {
    expect(statusChangeProblem({ from: "available", to: "sold", can: as("owner"), readiness: ready, ...base })).toBeNull();
    expect(statusChangeProblem({ from: "sold", to: "available", can: as("owner"), readiness: ready, ...base })).toBeNull();
  });

  it("rejects impossible moves", () => {
    expect(statusChangeProblem({ from: "draft", to: "sold", can: as("owner"), readiness: ready, ...base })).toMatch(/cannot move straight/);
    expect(statusChangeProblem({ from: "available", to: "available", can: as("owner"), readiness: ready, ...base })).toMatch(/already Available/);
  });

  it("sets listing and sale dates correctly", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    expect(statusChangeColumns("preparation", "available", { listedAt: null }, now)).toMatchObject({ status: "available", listed_at: now.toISOString(), sold_at: null });
    expect(statusChangeColumns("archived", "available", { listedAt: "2026-01-01T00:00:00Z" }, now)).toMatchObject({ listed_at: "2026-01-01T00:00:00Z" });
    expect(statusChangeColumns("available", "sold", { soldAt: null }, now)).toMatchObject({ status: "sold", sold_at: now.toISOString() });
    expect(statusChangeColumns("sold", "archived", { soldAt: "2026-09-01T00:00:00Z" }, now)).not.toHaveProperty("sold_at");
    expect(statusChangeColumns("sold", "available", { soldAt: "2026-09-01T00:00:00Z" }, now)).toMatchObject({ sold_at: null });
  });
});

describe("buying pipeline", () => {
  it("needs an accepted final offer before purchase", () => {
    expect(submissionTransitionProblem("final_offer", "purchased", { hasFinalOffer: false })).toMatch(/final offer/);
    expect(submissionTransitionProblem("final_offer", "purchased", { hasFinalOffer: true, offerAccepted: false })).toMatch(/accepted/);
    expect(submissionTransitionProblem("final_offer", "purchased", { hasFinalOffer: true, offerAccepted: true })).toBeNull();
  });

  it("freezes finished enquiries and never goes back to New", () => {
    for (const from of ["purchased", "declined", "closed"] as const) expect(submissionTransitionProblem(from, "reviewing")).toMatch(/cannot be changed/);
    expect(submissionTransitionProblem("reviewing", "new")).toMatch(/cannot go back/);
    expect(submissionTransitionProblem("final_offer", "provisional_offer")).toMatch(/final offer has already been made/);
  });

  it("treats an open offer past its expiry date as expired", () => {
    expect(effectiveOfferStatus({ status: "open", expires_on: "2026-10-27" }, "2026-10-28")).toBe("expired");
    expect(effectiveOfferStatus({ status: "open", expires_on: "2026-10-28" }, "2026-10-28")).toBe("open");
    expect(effectiveOfferStatus({ status: "accepted", expires_on: "2026-01-01" }, "2026-10-28")).toBe("accepted");
  });
});

describe("sales stages and handover", () => {
  it("only lets the reservation set Reserved and Sold", () => {
    expect(salesStageProblem("negotiating", "reserved")).toMatch(/Reserve the vehicle/);
    expect(salesStageProblem("reserved", "sold")).toMatch(/Complete the sale/);
    expect(salesStageProblem("reserved", "lost")).toMatch(/Cancel it/);
    expect(salesStageProblem("new", "contacted")).toBeNull();
  });

  it("seeds the checklist from Settings without inventing steps", () => {
    expect(checklistFromSettings([])).toEqual([]);
    expect(checklistFromSettings([" V5C checked ", "", "Keys handed over"])).toEqual([{ label: "V5C checked", done: false }, { label: "Keys handed over", done: false }]);
    expect(checklistComplete([{ label: "A", done: true }, { label: "B", done: false }])).toBe(false);
    expect(checklistComplete([{ label: "A", done: true }])).toBe(true);
  });

  it("defaults the reservation end only from the hold-days setting", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    expect(defaultReservationExpiry(0, now)).toBeNull();
    expect(defaultReservationExpiry(3, now)).toBe("2026-10-31T12:00:00.000Z");
  });
});

describe("helpers", () => {
  it("detects real file types from magic bytes", () => {
    expect(sniffContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffContentType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(sniffContentType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffContentType(new TextEncoder().encode("<html><script>"))).toBeNull();
  });

  it("reads datetime-local values as UK time across the clock change", () => {
    expect(londonLocalToIso("2026-07-01T10:00")).toBe("2026-07-01T09:00:00.000Z");
    expect(londonLocalToIso("2026-12-01T10:00")).toBe("2026-12-01T10:00:00.000Z");
    expect(londonLocalToIso("2026-10-25T09:00")).toBe("2026-10-25T09:00:00.000Z");
    expect(londonLocalToIso("2026-03-29T09:00")).toBe("2026-03-29T08:00:00.000Z");
  });
});
