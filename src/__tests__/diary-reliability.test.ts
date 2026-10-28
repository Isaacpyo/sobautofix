import { describe, expect, it, vi } from "vitest";
import { detectConflicts } from "@/lib/diary/conflicts";
import { gridHours, hoursConfigured, outsideHours, parseWeeklyHours } from "@/lib/diary/hours";
import { canChangeStatus, formStatusOptions, type DiaryEntry } from "@/lib/diary/types";
import { overrideAccepted, warningSignature } from "@/lib/diary/warnings";
import { isRetryDue, MAX_AUTOMATIC_RETRIES, nextRetryAt, retryStateLabel } from "@/lib/notifications/retry-policy";
import { retryEnquiryNotificationNow, runNotificationRetrySweep } from "@/lib/notifications/retry-sweep";

vi.mock("@/lib/enquiries/repository", () => ({ retryEnquiryNotifications: vi.fn(async () => "failed") }));

// A tiny in-memory stand-in for the Supabase query builder: enough to run the
// sweep against real filter semantics (eq, in, is, lt) and compare-and-set updates.
type Row = Record<string, unknown>;
function fakeClient(rows: Row[]) {
  return {
    rows,
    from() {
      let filters: Array<(row: Row) => boolean> = [];
      let patch: Row | null = null;
      let limit = Infinity;
      let single = false;
      const builder = {
        select() { return builder; },
        update(values: Row) { patch = values; return builder; },
        eq(column: string, value: unknown) { filters.push((row) => row[column] === value); return builder; },
        in(column: string, values: unknown[]) { filters.push((row) => values.includes(row[column])); return builder; },
        is(column: string, value: null) { filters.push((row) => (row[column] ?? null) === value); return builder; },
        lt(column: string, value: number) { filters.push((row) => Number(row[column]) < value); return builder; },
        or() { return builder; },
        order() { return builder; },
        limit(count: number) { limit = count; return builder; },
        maybeSingle() { single = true; return builder; },
        then(resolve: (value: { data: unknown; error: null }) => void) {
          const matched = rows.filter((row) => filters.every((filter) => filter(row))).slice(0, limit);
          if (patch) for (const row of matched) Object.assign(row, patch);
          filters = [];
          resolve({ data: single ? matched[0] ?? null : matched.map((row) => ({ ...row })), error: null });
        },
      };
      return builder;
    },
  };
}

const NOW = new Date("2026-10-28T12:00:00Z");

function enquiry(overrides: Row = {}): Row {
  return { id: "e1", type: "vehicle_sales", notification_status: "failed", notification_attempt_count: 0, notification_next_retry_at: null, created_at: "2026-10-28T11:00:00Z", deleted_at: null, ...overrides };
}

describe("notification retry policy", () => {
  it("backs off 15 minutes, 1 hour, then 6 hours, and stops after three", () => {
    expect(nextRetryAt(0, NOW)).toBe("2026-10-28T12:15:00.000Z");
    expect(nextRetryAt(1, NOW)).toBe("2026-10-28T13:00:00.000Z");
    expect(nextRetryAt(2, NOW)).toBe("2026-10-28T18:00:00.000Z");
    expect(nextRetryAt(3, NOW)).toBeNull();
    expect(MAX_AUTOMATIC_RETRIES).toBe(3);
  });

  it("is due only for failed exchange enquiries under the cap whose time has come", () => {
    const base = { type: "vehicle_sales", notification_status: "failed", notification_attempt_count: 1, notification_next_retry_at: "2026-10-28T11:59:00Z", created_at: "2026-10-01T00:00:00Z" };
    expect(isRetryDue(base, NOW)).toBe(true);
    expect(isRetryDue({ ...base, notification_next_retry_at: "2026-10-28T12:01:00Z" }, NOW)).toBe(false);
    expect(isRetryDue({ ...base, notification_attempt_count: 3 }, NOW)).toBe(false);
    expect(isRetryDue({ ...base, notification_status: "sent" }, NOW)).toBe(false);
    expect(isRetryDue({ ...base, type: "repair" }, NOW)).toBe(false);
  });

  it("picks up unscheduled failures only when recent, so old history is never re-sent", () => {
    const unscheduled = { type: "vehicle_purchase", notification_status: "failed", notification_attempt_count: 0, notification_next_retry_at: null };
    expect(isRetryDue({ ...unscheduled, created_at: "2026-10-28T10:00:00Z" }, NOW)).toBe(true);
    expect(isRetryDue({ ...unscheduled, created_at: "2026-10-20T10:00:00Z" }, NOW)).toBe(false);
  });

  it("describes the state for staff", () => {
    expect(retryStateLabel({ notification_attempt_count: 3, notification_next_retry_at: null }, NOW)).toBe("Stopped after 3 automatic retries");
    expect(retryStateLabel({ notification_attempt_count: 1, notification_next_retry_at: "2026-10-28T13:00:00Z" }, NOW)).toBe("Next retry in about 60 minutes");
  });
});

describe("notification retry sweep", () => {
  it("retries a due failure once, records the attempt and schedules the next", async () => {
    const client = fakeClient([enquiry()]);
    const send = vi.fn(async () => "failed");
    const result = await runNotificationRetrySweep(client as never, { now: NOW, send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ retried: 1, failed: 1, sent: 0 });
    expect(client.rows[0]).toMatchObject({ notification_attempt_count: 1, notification_next_retry_at: "2026-10-28T13:00:00.000Z" });
  });

  it("clears the schedule when the retry succeeds", async () => {
    const client = fakeClient([enquiry({ notification_attempt_count: 1, notification_next_retry_at: "2026-10-28T11:00:00Z" })]);
    const send = vi.fn(async (id: string) => {
      client.rows.find((row) => row.id === id)!.notification_status = "sent";
      return "sent";
    });
    const result = await runNotificationRetrySweep(client as never, { now: NOW, send });
    expect(result).toMatchObject({ retried: 1, sent: 1 });
    expect(client.rows[0]).toMatchObject({ notification_status: "sent", notification_attempt_count: 2, notification_next_retry_at: null });
  });

  it("stops after the third automatic retry and leaves the enquiry failed and visible", async () => {
    const client = fakeClient([enquiry({ notification_attempt_count: 2, notification_next_retry_at: "2026-10-28T11:00:00Z" })]);
    const send = vi.fn(async () => "failed");
    const result = await runNotificationRetrySweep(client as never, { now: NOW, send });
    expect(result).toMatchObject({ retried: 1, stopped: 1 });
    expect(client.rows[0]).toMatchObject({ notification_status: "failed", notification_attempt_count: 3, notification_next_retry_at: null });
    const again = await runNotificationRetrySweep(client as never, { now: new Date("2026-10-30T12:00:00Z"), send });
    expect(again.retried).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("ignores enquiries that are not due, not failed or not exchange enquiries", async () => {
    const client = fakeClient([
      enquiry({ id: "later", notification_attempt_count: 1, notification_next_retry_at: "2026-10-28T12:30:00Z" }),
      enquiry({ id: "sent", notification_status: "sent" }),
      enquiry({ id: "workshop", type: "repair" }),
      enquiry({ id: "deleted", deleted_at: "2026-10-28T00:00:00Z" }),
    ]);
    const send = vi.fn(async () => "sent");
    const result = await runNotificationRetrySweep(client as never, { now: NOW, send });
    expect(send).not.toHaveBeenCalled();
    expect(result.retried).toBe(0);
  });

  it("never sends twice when the claim was already taken", async () => {
    const client = fakeClient([enquiry()]);
    const send = vi.fn(async () => "failed");
    // Another sweep claims the row between our read and our claim.
    const originalFrom = client.from.bind(client);
    let reads = 0;
    client.from = () => {
      const builder = originalFrom();
      const originalUpdate = builder.update;
      builder.update = (values: Row) => {
        if (reads === 0) client.rows[0]!.notification_attempt_count = 1;
        reads += 1;
        return originalUpdate(values);
      };
      return builder;
    };
    const result = await runNotificationRetrySweep(client as never, { now: NOW, send });
    expect(send).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("lets staff retry by hand after the automatic retries stop", async () => {
    const client = fakeClient([enquiry({ notification_attempt_count: 3 })]);
    const send = vi.fn(async () => "sent");
    const result = await retryEnquiryNotificationNow(client as never, "e1", { now: NOW, send });
    expect(send).toHaveBeenCalledWith("e1");
    expect(result.sent).toBe(1);
  });
});

describe("opening hours from Settings", () => {
  const empty = parseWeeklyHours({ monday: "", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" });
  const weekdays = parseWeeklyHours({ monday: "08:00–17:30", tuesday: "08:00–17:30", wednesday: "08:00-17:30", thursday: "08:00–17:30", friday: "08:00–17:00", saturday: "09:00–13:00", sunday: "" });

  it("shows a neutral full day and never warns when no hours are configured", () => {
    expect(hoursConfigured(empty)).toBe(false);
    expect(gridHours(empty)).toEqual({ from: 0, to: 24 });
    expect(outsideHours("2026-10-28T06:00:00Z", "2026-10-28T07:00:00Z", empty)).toBeNull();
  });

  it("uses configured hours for the grid span and warnings", () => {
    expect(hoursConfigured(weekdays)).toBe(true);
    expect(gridHours(weekdays)).toEqual({ from: 8, to: 18 });
    // Wednesday 28 Oct 2026 (GMT): 07:30 is before opening.
    expect(outsideHours("2026-10-28T07:30:00Z", "2026-10-28T08:30:00Z", weekdays)).toEqual({ open: "08:00", close: "17:30" });
    expect(outsideHours("2026-10-28T09:00:00Z", "2026-10-28T10:00:00Z", weekdays)).toBe(false);
    // Summer: 08:30 BST is 07:30 UTC and inside the hours.
    expect(outsideHours("2026-07-15T07:30:00Z", "2026-07-15T08:30:00Z", weekdays)).toBe(false);
    // Sunday has no configured hours: unknown, so no warning.
    expect(outsideHours("2026-11-01T06:00:00Z", "2026-11-01T07:00:00Z", weekdays)).toBeNull();
  });
});

describe("appointment status flow", () => {
  it("goes requested -> confirmed -> completed, cancelled or no-show", () => {
    expect(canChangeStatus(null, "requested")).toBe(true);
    expect(canChangeStatus(null, "confirmed")).toBe(true);
    expect(canChangeStatus(null, "completed")).toBe(false);
    expect(canChangeStatus("requested", "confirmed")).toBe(true);
    expect(canChangeStatus("requested", "completed")).toBe(false);
    expect(canChangeStatus("confirmed", "requested")).toBe(false);
    expect(canChangeStatus("confirmed", "no_show")).toBe(true);
    expect(canChangeStatus("completed", "confirmed")).toBe(false);
    expect(canChangeStatus("cancelled", "confirmed")).toBe(false);
    expect(formStatusOptions("requested")).toEqual(["requested", "confirmed"]);
    expect(formStatusOptions("confirmed")).toEqual(["confirmed", "completed", "no_show"]);
  });
});

describe("conflict overrides", () => {
  const entry: DiaryEntry = {
    key: "booking:b1", id: "b1", source: "booking", type: "workshop_booking", status: "confirmed", statusLabel: "Confirmed", title: "Service",
    start: "2026-10-30T11:00:00Z", end: "2026-10-30T12:00:00Z", location: null, assignedTo: "u1", assignedName: "Owner", customerId: null, customerName: null,
    vehicleLabel: null, saleVehicleId: null, workshopVehicleId: null, enquiryId: null, sellerSubmissionId: null, vehicleSaleId: null, notes: null, reference: null,
    sourceHref: null, sourceLabel: null, href: "/admin/diary/b1",
  };
  const conflicts = detectConflicts({ kind: "viewing", start: "2026-10-30T11:30:00Z", end: "2026-10-30T12:15:00Z", assignedTo: "u1" }, [entry]);

  it("needs the same warnings acknowledged and a reason", () => {
    const signature = warningSignature(conflicts, null);
    expect(overrideAccepted(signature, { acknowledged: signature, reason: "Customer can only come then" })).toBe(true);
    expect(overrideAccepted(signature, { acknowledged: signature, reason: "  " })).toBe(false);
    expect(overrideAccepted(signature, { acknowledged: "something else", reason: "Fine" })).toBe(false);
    expect(overrideAccepted(signature, undefined)).toBe(false);
  });

  it("changes the signature when the outside-hours warning appears", () => {
    expect(warningSignature(conflicts, { open: "08:00", close: "17:30" })).not.toBe(warningSignature(conflicts, null));
    expect(warningSignature([], null)).toBe("");
  });
});
