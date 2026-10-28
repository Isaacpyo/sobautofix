import { describe, expect, it } from "vitest";
import { conflictSignature, detectConflicts } from "@/lib/diary/conflicts";
import { conflictViews } from "@/lib/diary/form-state";
import { entriesOnDate, groupByStartDate, layoutDay, visibleHours } from "@/lib/diary/layout";
import { appointmentLinks, canSeeNotes, filterEntries, mapAppointment, mapBooking, sortEntries, type AppointmentRow, type BookingRow } from "@/lib/diary/mapping";
import { diaryHref, parseDiaryParams } from "@/lib/diary/params";
import type { DiaryEntry } from "@/lib/diary/types";

const OWNER = "8e1b7c3a-1d2e-4f50-9a6b-7c8d9e0f1a2b";
const SALES = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d";
const VEHICLE = "0f1e2d3c-4b5a-4968-8776-655443322110";
const staffNames = new Map([[OWNER, "Owner"], [SALES, "Sam Sales"]]);

function appointment(overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  return {
    id: "a0000000-0000-4000-8000-000000000001",
    kind: "viewing",
    status: "confirmed",
    title: "Viewing: 2019 Ford Focus",
    starts_at: "2026-10-30T11:00:00+00:00",
    ends_at: "2026-10-30T11:45:00+00:00",
    location: null,
    assigned_to: SALES,
    customer_id: "c0000000-0000-4000-8000-000000000001",
    sale_vehicle_id: VEHICLE,
    enquiry_id: "e0000000-0000-4000-8000-000000000001",
    seller_submission_id: null,
    vehicle_sale_id: null,
    notes: "Buyer wants finance figures",
    customers: { name: "Dana Buyer", anonymised_at: null },
    sale_vehicles: { make: "Ford", model: "Focus", year: 2019, stock_reference: "STK-10001" },
    ...overrides,
  };
}

function booking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: "b0000000-0000-4000-8000-000000000001",
    booking_reference: "SOB-123456",
    status: "rescheduled",
    service_name: "Full service",
    appointment_start: "2026-10-30T11:00:00+00:00",
    appointment_end: null,
    location: "SOB Autofix workshop",
    location_mode: "workshop",
    assigned_to: OWNER,
    customer_id: "c0000000-0000-4000-8000-000000000002",
    vehicle_id: "d0000000-0000-4000-8000-000000000002",
    notes: "Customer will wait",
    customers: [{ name: "Wes Workshop", anonymised_at: null }],
    vehicles: { make: "Skoda", model: "Octavia", registration: "de67 fgh" },
    ...overrides,
  };
}

describe("booking to diary mapping", () => {
  it("reads a workshop booking directly, with a one-hour default end and its own status label", () => {
    const entry = mapBooking(booking(), { role: "owner", staffNames });
    expect(entry).toMatchObject({
      key: "booking:b0000000-0000-4000-8000-000000000001",
      source: "booking",
      type: "workshop_booking",
      status: "confirmed",
      statusLabel: "Rescheduled",
      end: "2026-10-30T12:00:00.000Z",
      assignedName: "Owner",
      customerName: "Wes Workshop",
      vehicleLabel: "Skoda Octavia · DE67FGH",
      reference: "SOB-123456",
      sourceHref: "/admin/bookings/b0000000-0000-4000-8000-000000000001",
      href: "/admin/diary/b0000000-0000-4000-8000-000000000001",
    });
  });

  it("maps pending bookings to requested and keeps a real end time", () => {
    const entry = mapBooking(booking({ status: "pending", appointment_end: "2026-10-30T12:30:00+00:00" }), { role: "owner", staffNames });
    expect(entry.status).toBe("requested");
    expect(entry.end).toBe("2026-10-30T12:30:00+00:00");
  });

  it("shows Anonymised instead of a removed customer's name", () => {
    expect(mapBooking(booking({ customers: { name: "Anonymised", anonymised_at: "2026-01-01T00:00:00Z" } }), { role: "owner", staffNames }).customerName).toBe("Anonymised");
  });
});

describe("appointment mapping and role visibility", () => {
  it("links a viewing to its sales enquiry, stock vehicle and customer for sales staff", () => {
    const entry = mapAppointment(appointment(), { role: "sales", staffNames });
    expect(entry.sourceHref).toBe("/admin/exchange/sales/e0000000-0000-4000-8000-000000000001");
    expect(appointmentLinks(appointment(), "sales").map((link) => link.href)).toEqual([
      "/admin/exchange/sales/e0000000-0000-4000-8000-000000000001",
      `/admin/exchange/stock/${VEHICLE}`,
      "/admin/customers/c0000000-0000-4000-8000-000000000001",
    ]);
    expect(entry.notes).toBe("Buyer wants finance figures");
    expect(entry.vehicleLabel).toBe("2019 Ford Focus · STK-10001");
  });

  it("links handovers to the sale and purchase inspections to the buying enquiry", () => {
    expect(mapAppointment(appointment({ kind: "handover", vehicle_sale_id: "f0000000-0000-4000-8000-000000000001" }), { role: "owner", staffNames }).sourceHref).toBe("/admin/exchange/handover/f0000000-0000-4000-8000-000000000001");
    expect(mapAppointment(appointment({ kind: "purchase_inspection", seller_submission_id: "50000000-0000-4000-8000-000000000001" }), { role: "owner", staffNames }).sourceHref).toBe("/admin/exchange/buying/50000000-0000-4000-8000-000000000001");
  });

  it("gives workshop staff the name but not sales notes or customer and sales links", () => {
    const entry = mapAppointment(appointment(), { role: "workshop", staffNames });
    expect(entry.customerName).toBe("Dana Buyer");
    expect(entry.notes).toBeNull();
    expect(entry.sourceHref).toBe(`/admin/exchange/stock/${VEHICLE}`);
    expect(appointmentLinks(appointment(), "workshop").some((link) => link.href.startsWith("/admin/customers"))).toBe(false);
  });

  it("lets workshop staff see notes on preparation and workshop bookings", () => {
    expect(canSeeNotes("workshop", "preparation")).toBe(true);
    expect(canSeeNotes("workshop", "workshop_booking")).toBe(true);
    expect(canSeeNotes("workshop", "viewing")).toBe(false);
    expect(canSeeNotes("workshop", "handover")).toBe(false);
    expect(mapAppointment(appointment({ kind: "preparation" }), { role: "workshop", staffNames }).notes).toBe("Buyer wants finance figures");
  });

  it("names a staff member who has since left", () => {
    expect(mapAppointment(appointment({ assigned_to: "99999999-0000-4000-8000-000000000000" }), { role: "owner", staffNames }).assignedName).toBe("Former staff member");
  });
});

describe("filters and ordering", () => {
  const entries = [
    mapAppointment2(appointment({ id: "a0000000-0000-4000-8000-000000000009", starts_at: "2026-10-30T13:00:00+00:00", ends_at: "2026-10-30T14:00:00+00:00", assigned_to: null })),
    mapBooking(booking(), { role: "owner", staffNames }),
    mapAppointment2(appointment()),
  ];

  it("sorts by start then end", () => {
    expect(sortEntries(entries).map((entry) => entry.key)).toEqual([
      "appointment:a0000000-0000-4000-8000-000000000001",
      "booking:b0000000-0000-4000-8000-000000000001",
      "appointment:a0000000-0000-4000-8000-000000000009",
    ]);
  });

  it("filters by type, staff (including unassigned) and status", () => {
    expect(filterEntries(entries, { type: "workshop_booking" })).toHaveLength(1);
    expect(filterEntries(entries, { staff: OWNER }).map((entry) => entry.source)).toEqual(["booking"]);
    expect(filterEntries(entries, { staff: "unassigned" })).toHaveLength(1);
    expect(filterEntries(entries, { status: "confirmed" })).toHaveLength(3);
  });
});

function mapAppointment2(row: AppointmentRow) {
  return mapAppointment(row, { role: "owner", staffNames });
}

describe("conflict detection", () => {
  const viewing = mapAppointment2(appointment());
  const workshop = mapBooking(booking(), { role: "owner", staffNames });

  it("warns about the same staff member across appointments and bookings", () => {
    const conflicts = detectConflicts({ kind: "preparation", start: "2026-10-30T11:30:00Z", end: "2026-10-30T12:30:00Z", assignedTo: OWNER }, [viewing, workshop]);
    expect(conflicts.map((conflict) => [conflict.reason, conflict.entry.key])).toEqual([["same_staff", workshop.key]]);
  });

  it("warns about the same vehicle and about another viewing in the slot", () => {
    const conflicts = detectConflicts({ kind: "viewing", start: "2026-10-30T11:15:00Z", end: "2026-10-30T12:00:00Z", saleVehicleId: VEHICLE }, [viewing, workshop]);
    expect(conflicts.map((conflict) => conflict.reason).sort()).toEqual(["same_vehicle", "same_viewing_slot"]);
    const views = conflictViews(conflicts);
    expect(views).toHaveLength(1);
    expect(views[0]?.reasons).toHaveLength(2);
  });

  it("ignores the appointment being edited, cancelled entries and back-to-back times", () => {
    expect(detectConflicts({ id: viewing.id, kind: "viewing", start: viewing.start, end: viewing.end, assignedTo: SALES, saleVehicleId: VEHICLE }, [viewing])).toEqual([]);
    const cancelled = { ...viewing, key: "appointment:x", id: "x", status: "cancelled" as const };
    expect(detectConflicts({ kind: "viewing", start: viewing.start, end: viewing.end, saleVehicleId: VEHICLE }, [cancelled])).toEqual([]);
    expect(detectConflicts({ kind: "viewing", start: "2026-10-30T11:45:00Z", end: "2026-10-30T12:30:00Z", assignedTo: SALES, saleVehicleId: VEHICLE }, [viewing])).toEqual([]);
  });

  it("does not flag unrelated entries", () => {
    expect(detectConflicts({ kind: "collection", start: "2026-10-30T11:00:00Z", end: "2026-10-30T12:00:00Z", assignedTo: null }, [viewing, workshop])).toEqual([]);
  });

  it("has an order-independent signature", () => {
    const conflicts = detectConflicts({ kind: "viewing", start: "2026-10-30T11:00:00Z", end: "2026-10-30T12:00:00Z", assignedTo: OWNER, saleVehicleId: VEHICLE }, [viewing, workshop]);
    expect(conflictSignature(conflicts)).toBe(conflictSignature([...conflicts].reverse()));
    expect(conflictSignature([])).toBe("");
  });
});

describe("day layout", () => {
  const at = (key: string, start: string, end: string): DiaryEntry => ({ ...mapAppointment2(appointment()), key, id: key, start, end });

  it("places overlapping entries side by side and the rest full width", () => {
    const entries = [at("a", "2026-10-30T09:00:00Z", "2026-10-30T10:00:00Z"), at("b", "2026-10-30T09:30:00Z", "2026-10-30T10:30:00Z"), at("c", "2026-10-30T11:00:00Z", "2026-10-30T12:00:00Z")];
    const layout = layoutDay(entries, "2026-10-30");
    expect(layout.map((item) => [item.entry.key, item.column, item.columns, item.top])).toEqual([["a", 0, 2, 540], ["b", 1, 2, 570], ["c", 0, 1, 660]]);
    expect(visibleHours(layout)).toEqual({ from: 7, to: 19 });
  });

  it("uses wall-clock positions on the clock-change days", () => {
    const spring = layoutDay([at("s", "2026-03-29T08:00:00Z", "2026-03-29T09:00:00Z")], "2026-03-29");
    expect(spring[0]).toMatchObject({ top: 540, bottom: 600 });
    const autumn = layoutDay([at("f", "2026-10-25T09:00:00Z", "2026-10-25T10:00:00Z")], "2026-10-25");
    expect(autumn[0]).toMatchObject({ top: 540, bottom: 600 });
  });

  it("finds entries on a London date, including those after 23:00 UTC in summer", () => {
    const late = at("late", "2026-06-30T23:30:00Z", "2026-07-01T00:30:00Z");
    expect(entriesOnDate([late], "2026-07-01")).toHaveLength(1);
    expect(entriesOnDate([late], "2026-06-30")).toHaveLength(0);
    expect([...groupByStartDate([late]).keys()]).toEqual(["2026-07-01"]);
    expect(visibleHours(layoutDay([late], "2026-07-01"))).toEqual({ from: 0, to: 19 });
  });
});

describe("diary URL", () => {
  it("keeps only recognised values", () => {
    expect(parseDiaryParams({ view: "week", date: "2026-10-28", type: "viewing", staff: OWNER, status: "requested" }, "2026-01-01")).toEqual({ view: "week", date: "2026-10-28", type: "viewing", staff: OWNER, status: "requested" });
    expect(parseDiaryParams({ view: "year", date: "2026-13-01", type: "x", staff: "Bob Smith", status: "maybe" }, "2026-01-01")).toEqual({ view: null, date: "2026-01-01", type: "", staff: "", status: "" });
  });

  it("builds links without personal data", () => {
    const state = parseDiaryParams({ date: "2026-10-28", staff: "unassigned" }, "2026-10-28");
    expect(diaryHref(state, { view: "day" })).toBe("/admin/diary?view=day&date=2026-10-28&staff=unassigned");
  });
});
