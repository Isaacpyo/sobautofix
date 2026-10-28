import { beforeEach, describe, expect, it, vi } from "vitest";
import { canSeeNotes, appointmentLinks } from "@/lib/diary/mapping";
import { can, staffRoles, type ExchangePermission, type StaffRole } from "@/lib/exchange/permissions";

// Independent verification of who may do what (delivery brief criterion 11).
// Modules from other lanes are loaded with import.meta.glob, so these checks
// skip cleanly until those lanes are merged and then run automatically.

const auth = { role: "sales" as StaffRole };
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock("@/lib/supabase/server", () => ({
  getAdminUser: async () => ({ user: { id: "11111111-1111-4111-8111-111111111111" }, profile: { display_name: "Test" }, mfaState: "verified", mfaRequired: false, mfaVerified: true }),
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { staff_role: auth.role }, error: null }) }) }) }),
  }),
}));

const laneModules = import.meta.glob(["../lib/exchange/admin/stock-rules.ts", "../lib/exchange/admin/documents.ts"]);
const load = async <T,>(path: string) => (laneModules[path] ? ((await laneModules[path]()) as T) : null);

describe("permission matrix", () => {
  const denied: Record<StaffRole, ExchangePermission[]> = {
    owner: [],
    manager: ["settings.manage"],
    sales: ["stock.publish", "stock.price", "finance.view", "finance.edit", "settings.manage", "prep.manage"],
    workshop: ["customers.view", "sales.manage", "buying.manage", "stock.edit", "stock.publish", "stock.price", "finance.view", "finance.edit", "settings.manage"],
  };

  it.each(staffRoles)("%s is refused exactly what the matrix says", (role) => {
    for (const permission of denied[role]) expect(can(role, permission), `${role} ${permission}`).toBe(false);
    expect(can(role, "diary.manage")).toBe(true);
    expect(can(role, "exchange.view")).toBe(true);
  });
});

describe("server actions refuse what the role cannot do", () => {
  beforeEach(() => vi.resetModules());

  it("stops sales staff publishing, changing prices or touching finance", async () => {
    auth.role = "sales";
    const { requireStaffAction, StaffPermissionError } = await import("@/lib/exchange/staff");
    for (const permission of ["stock.publish", "stock.price", "finance.view", "finance.edit", "settings.manage"] as const) {
      await expect(requireStaffAction(permission), permission).rejects.toBeInstanceOf(StaffPermissionError);
    }
    await expect(requireStaffAction("stock.edit")).resolves.toMatchObject({ role: "sales" });
  });

  it("stops workshop staff seeing customer contacts or working enquiries", async () => {
    auth.role = "workshop";
    const { requireStaffAction, StaffPermissionError } = await import("@/lib/exchange/staff");
    for (const permission of ["customers.view", "sales.manage", "buying.manage"] as const) {
      await expect(requireStaffAction(permission), permission).rejects.toBeInstanceOf(StaffPermissionError);
    }
    await expect(requireStaffAction("diary.manage")).resolves.toMatchObject({ role: "workshop" });
  });
});

describe("diary visibility for workshop staff", () => {
  it("gives no links to customer records and hides sales notes", () => {
    const row = { vehicle_sale_id: null, seller_submission_id: null, enquiry_id: "e0000000-0000-4000-8000-000000000001", sale_vehicle_id: null, customer_id: "c0000000-0000-4000-8000-000000000001" };
    expect(appointmentLinks(row, "workshop")).toEqual([]);
    expect(appointmentLinks(row, "sales").map((link) => link.label)).toEqual(["Sales enquiry", "Customer"]);
    expect(canSeeNotes("workshop", "viewing")).toBe(false);
  });
});

type StockRules = { permissionForStatusChange: (from: string, to: string) => ExchangePermission };
type Documents = { canViewDocuments: (staff: { can: (permission: ExchangePermission) => boolean }, document: { seller_submission_id: string | null; sale_vehicle_id: string | null }) => boolean; uploadPermission: (request: { target: string; submissionId?: string }) => ExchangePermission };

describe.skipIf(!laneModules["../lib/exchange/admin/stock-rules.ts"])("stock status changes (staff operations lane)", () => {
  it("treats every listing change as publishing, which sales cannot do", async () => {
    const rules = (await load<StockRules>("../lib/exchange/admin/stock-rules.ts"))!;
    expect(rules.permissionForStatusChange("draft", "available")).toBe("stock.publish");
    expect(rules.permissionForStatusChange("available", "archived")).toBe("stock.publish");
    expect(can("sales", rules.permissionForStatusChange("preparation", "available"))).toBe(false);
  });
});

describe.skipIf(!laneModules["../lib/exchange/admin/documents.ts"])("private documents (staff operations lane)", () => {
  it("lets only stock, preparation or buying staff open documents", async () => {
    const documents = (await load<Documents>("../lib/exchange/admin/documents.ts"))!;
    const as = (role: StaffRole) => ({ can: (permission: ExchangePermission) => can(role, permission) });
    expect(documents.canViewDocuments(as("workshop"), { seller_submission_id: "s", sale_vehicle_id: null })).toBe(true);
    expect(documents.uploadPermission({ target: "stock_photo" })).toBe("stock.edit");
    expect(can("workshop", documents.uploadPermission({ target: "stock_photo" }))).toBe(false);
  });

  // Reported to the coordinator: purchase and sale invoices show what SOB paid,
  // but canViewDocuments does not require finance.view for those kinds.
  // Finance-only invoices: covered in admin-exchange-documents.test.ts ("finance-only documents").
});
