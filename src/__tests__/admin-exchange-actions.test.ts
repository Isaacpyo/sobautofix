import { beforeEach, describe, expect, it, vi } from "vitest";
import { can, type StaffRole } from "@/lib/exchange/permissions";

// Server actions run against a fake Supabase client so we can prove that the
// permission and consistency rules stop a write before it reaches the database.

type Call = { table: string; op: string; values?: unknown; filters: Array<[string, unknown]> };
const harness = vi.hoisted(() => ({
  role: "owner" as string,
  calls: [] as Call[],
  rows: {} as Record<string, unknown>,
  updateResult: null as unknown,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn(), redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/exchange/settings", () => ({ getExchangePrivateSettings: async () => ({ notificationRecipients: [], viewingLengthMinutes: 45, minimumPublishPhotos: 4, sellerRetentionMonths: 12, reservationHoldDays: 0, handoverChecklist: [] }) }));

function fakeClient() {
  return {
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      const respond = () => {
        if (call.op === "select") return { data: harness.rows[table] ?? [], error: null };
        harness.calls.push(call);
        if (call.op === "update" && harness.updateResult !== null) return { data: harness.updateResult, error: null };
        return { data: [{ id: "00000000-0000-4000-8000-0000000000aa" }], error: null };
      };
      const query: Record<string, unknown> = {};
      const chain = new Proxy(query, {
        get(_target, prop: string) {
          if (prop === "then") return (resolve: (value: unknown) => void) => resolve(respond());
          if (["insert", "update", "upsert", "delete"].includes(prop)) return (values?: unknown) => { call.op = prop; call.values = values; return chain; };
          if (prop === "single" || prop === "maybeSingle") return async () => {
            const result = respond() as { data: unknown };
            return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: null };
          };
          return (...args: unknown[]) => { if (["eq", "is", "neq", "in"].includes(prop)) call.filters.push([String(args[0]), args[1]]); return chain; };
        },
      });
      return chain;
    },
  };
}

vi.mock("@/lib/exchange/staff", async () => {
  const actual = await vi.importActual<typeof import("@/lib/exchange/staff")>("@/lib/exchange/staff");
  const { can: allowed } = await vi.importActual<typeof import("@/lib/exchange/permissions")>("@/lib/exchange/permissions");
  const staff = () => ({ userId: "00000000-0000-4000-8000-000000000001", displayName: "Test", role: harness.role, can: (permission: Parameters<typeof allowed>[1]) => allowed(harness.role as StaffRole, permission), client: fakeClient() });
  return {
    ...actual,
    requireStaffAction: async (permission: Parameters<typeof allowed>[1]) => {
      if (!allowed(harness.role as StaffRole, permission)) throw new actual.StaffPermissionError();
      return staff();
    },
    getStaffForRoute: async (permission: Parameters<typeof allowed>[1]) => allowed(harness.role as StaffRole, permission) ? { staff: staff(), status: 200 } : { staff: null, status: 403 },
    auditStaffAction: async () => undefined,
  };
});

import { saveCostAction, changeStockStatusAction, saveListingAction } from "@/app/admin/(protected)/exchange/stock/actions";
import { updateSaleAction } from "@/app/admin/(protected)/exchange/sales/actions";
import { GET as exportReport } from "@/app/api/admin/exchange/reports/export/route";
import { idleState } from "@/components/admin/exchange/form-state";
import { STOCK_CONFLICT_MESSAGE } from "@/lib/exchange/admin/stock";

const vehicleId = "00000000-0000-4000-8000-000000000010";
const updatedAt = "2026-10-28T10:00:00.000000+00:00";
const vehicleRow = {
  id: vehicleId, registration: null, slug: "2019-ford-focus-ab123", make: "Ford", model: "Focus", derivative: null, year: 2019, mileage: 40000, price: 9000, fuel_type: "Petrol", transmission: "Manual",
  engine_size: null, colour: null, body_type: null, description: "A clean car with a full service history and two keys.", features: [], warranty: null, finance_available: false,
  status: "preparation", sold_at: null, created_at: "2026-10-01T10:00:00Z", updated_at: updatedAt, listing_condition: "ready_to_drive", write_off_status: "not_confirmed",
  condition_summary: "Light marks on the rear bumper; interior clean.", known_faults: [], work_completed: [], service_history: "not_confirmed", listed_at: null, sale_vehicle_images: [],
};

function listingForm(price: number) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ vehicleId, updatedAt, make: "Ford", model: "Focus", year: "2019", mileage: "40000", price: String(price), fuelType: "Petrol", transmission: "Manual", description: vehicleRow.description })) form.set(key, value);
  return form;
}

const writes = (table: string) => harness.calls.filter((call) => call.table === table);

beforeEach(() => {
  harness.calls = [];
  harness.updateResult = null;
  harness.rows = { sale_vehicles: [vehicleRow], vehicle_sales: [] };
});

describe("stock actions enforce permissions on the server", () => {
  it("does not let the sales role change the advertised price", async () => {
    harness.role = "sales";
    const result = await saveListingAction(idleState, listingForm(9500));
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.price).toMatch(/owner or manager/);
    expect(result.values?.price).toBe("9500");
    expect(writes("sale_vehicles")).toHaveLength(0);
  });

  it("lets the sales role edit the listing when the price is unchanged, with compare-and-set", async () => {
    harness.role = "sales";
    const result = await saveListingAction(idleState, listingForm(9000));
    expect(result.status).toBe("success");
    const update = writes("sale_vehicles")[0]!;
    expect(update.op).toBe("update");
    expect(update.filters).toContainEqual(["updated_at", updatedAt]);
  });

  it("reports a concurrent edit instead of overwriting it", async () => {
    harness.role = "owner";
    harness.updateResult = [];
    const result = await saveListingAction(idleState, listingForm(9000));
    expect(result).toMatchObject({ status: "error", message: STOCK_CONFLICT_MESSAGE });
    expect(result.values?.make).toBe("Ford");
  });

  it("keeps cost lines away from the sales role", async () => {
    harness.role = "sales";
    const form = new FormData();
    for (const [key, value] of Object.entries({ vehicleId, category: "repair", description: "Brakes", amount: "120", basis: "actual" })) form.set(key, value);
    const result = await saveCostAction(idleState, form);
    expect(result).toMatchObject({ status: "error", message: "You do not have permission to do that." });
    expect(writes("vehicle_costs")).toHaveLength(0);
  });

  it("stops the sales role publishing", async () => {
    harness.role = "sales";
    const form = new FormData();
    form.set("vehicleId", vehicleId);
    form.set("status", "available");
    const result = await changeStockStatusAction(idleState, form);
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/owner or manager/);
    expect(writes("sale_vehicles")).toHaveLength(0);
  });

  it("blocks publishing until the vehicle is ready, even for an owner", async () => {
    harness.role = "owner";
    const form = new FormData();
    form.set("vehicleId", vehicleId);
    form.set("status", "available");
    const result = await changeStockStatusAction(idleState, form);
    expect(result.message).toMatch(/At least 4 photographs/);
    expect(writes("sale_vehicles")).toHaveLength(0);
  });

  it("publishes a ready vehicle and stamps the first listing date", async () => {
    harness.role = "manager";
    harness.rows.sale_vehicles = [{ ...vehicleRow, sale_vehicle_images: [0, 1, 2, 3].map((position) => ({ id: `i${position}`, object_path: `${vehicleId}/${position}.jpg`, alt_text: "Photo of the car", position })) }];
    const form = new FormData();
    form.set("vehicleId", vehicleId);
    form.set("status", "available");
    form.set("updatedAt", updatedAt);
    const result = await changeStockStatusAction(idleState, form);
    expect(result.status).toBe("success");
    const update = writes("sale_vehicles")[0]!;
    expect(update.values).toMatchObject({ status: "available", reserved_at: null, sold_at: null });
    expect((update.values as { listed_at: string }).listed_at).toBeTruthy();
    expect(update.filters).toContainEqual(["updated_at", updatedAt]);
  });
});

describe("finance-only records", () => {
  it("does not let the sales role change payment details", async () => {
    harness.role = "sales";
    harness.rows.vehicle_sales = [{ id: "s1", status: "reserved", updated_at: updatedAt, agreed_price_pence: 900000, deposit_pence: 0, amount_paid_pence: 0, payment_status: "not_started", payment_method: null, part_exchange_allowance_pence: null, handover_checklist: [], sale_vehicle_id: vehicleId, enquiry_id: null, part_exchange_submission_id: null, sale_vehicles: { slug: "x", price: 9000 } }];
    const form = new FormData();
    for (const [key, value] of Object.entries({ saleId: "00000000-0000-4000-8000-000000000020", status: "reserved", agreedPrice: "9000", amountPaid: "500", paymentStatus: "deposit_received", handoverMethod: "collection" })) form.set(key, value);
    const result = await updateSaleAction(idleState, form);
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/owner or manager can change payment details/);
    expect(writes("vehicle_sales")).toHaveLength(0);
  });

  it("refuses the costs CSV to roles without finance access", async () => {
    harness.role = "sales";
    const response = await exportReport(new Request("http://localhost/api/admin/exchange/reports/export") as never);
    expect(response.status).toBe(403);
    harness.role = "owner";
    harness.rows = { sale_vehicles: [], vehicle_costs: [], vehicle_internal_records: [], vehicle_sales: [], seller_submissions: [] };
    const allowed = await exportReport(Object.assign(new Request("http://localhost/api/admin/exchange/reports/export?period=30"), { nextUrl: new URL("http://localhost/api/admin/exchange/reports/export?period=30") }) as never);
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("content-type")).toMatch(/text\/csv/);
    expect(allowed.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("matches the documented permission matrix", () => {
    expect(can("sales", "finance.edit")).toBe(false);
    expect(can("manager", "finance.edit")).toBe(true);
  });
});
