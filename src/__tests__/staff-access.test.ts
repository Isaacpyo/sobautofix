// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { visibleNavigationGroups } from "@/components/admin/admin-navigation";
import { can, exchangePermissions, permissionDescriptions, permissionsFor, staffRoles } from "@/lib/exchange/permissions";
import { activeOwnerCount, staffStatus } from "@/lib/staff/rules";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/admin/login/actions", () => ({ signOut: vi.fn() }));

const navLabels = (role: (typeof staffRoles)[number]) => visibleNavigationGroups(role).flatMap((group) => group.links.map((link) => link.label));

describe("staff status", () => {
  it("is removed when access was removed, whatever the sign-in history", () => {
    expect(staffStatus({ accessRemovedAt: "2026-11-01T09:00:00Z", lastSignInAt: "2026-10-01T09:00:00Z" })).toBe("removed");
  });
  it("is invited until the first sign-in, then active", () => {
    expect(staffStatus({ accessRemovedAt: null, lastSignInAt: null })).toBe("invited");
    expect(staffStatus({ accessRemovedAt: null, lastSignInAt: "2026-10-01T09:00:00Z" })).toBe("active");
  });
});

describe("active owner count", () => {
  it("counts owners with access and treats a missing role as owner", () => {
    expect(activeOwnerCount([
      { staff_role: "owner", access_removed_at: null },
      { staff_role: null, access_removed_at: null },
      { staff_role: "owner", access_removed_at: "2026-11-01T09:00:00Z" },
      { staff_role: "manager", access_removed_at: null },
    ])).toBe(2);
  });
});

describe("role permissions", () => {
  it("gives owners everything", () => {
    expect(permissionsFor("owner")).toEqual([...exchangePermissions]);
  });
  it("keeps staff and website settings with owners only", () => {
    for (const role of ["manager", "sales", "workshop"] as const) {
      expect(can(role, "staff.manage")).toBe(false);
      expect(can(role, "site.manage")).toBe(false);
      expect(can(role, "settings.manage")).toBe(false);
    }
  });
  it("lets managers run money, content and pricing", () => {
    for (const permission of ["finance.view", "finance.edit", "content.manage", "pricing.manage", "stock.publish", "stock.price"] as const) expect(can("manager", permission)).toBe(true);
  });
  it("keeps money, prices and website content away from sales", () => {
    for (const permission of ["finance.view", "finance.edit", "stock.price", "stock.publish", "content.manage", "pricing.manage"] as const) expect(can("sales", permission)).toBe(false);
    for (const permission of ["stock.edit", "buying.manage", "sales.manage", "customers.view", "diary.manage"] as const) expect(can("sales", permission)).toBe(true);
  });
  it("limits the workshop to preparation and the diary", () => {
    expect(permissionsFor("workshop")).toEqual(["exchange.view", "prep.manage", "diary.manage"]);
  });
  it("describes every permission in plain words", () => {
    for (const permission of exchangePermissions) expect(permissionDescriptions[permission]).toMatch(/\w{3}/);
  });
});

describe("admin navigation by role", () => {
  it("shows owners Staff & access and Settings", () => {
    const labels = navLabels("owner");
    expect(labels).toContain("Staff & access");
    expect(labels).toContain("Settings");
    expect(labels).toContain("Invoices");
  });
  it("hides Staff & access and Settings from managers but keeps invoices and content", () => {
    const labels = navLabels("manager");
    expect(labels).not.toContain("Staff & access");
    expect(labels).not.toContain("Settings");
    expect(labels).toContain("Invoices");
    expect(labels).toContain("News & Blog");
  });
  it("hides invoices, pricing, content and staff from sales", () => {
    const labels = navLabels("sales");
    for (const label of ["Invoices", "Pricing", "Offers", "News & Blog", "Media", "Reviews", "Trash", "Settings", "Staff & access"]) expect(labels).not.toContain(label);
    expect(labels).toContain("Enquiries");
  });
  it("never shows an empty group", () => {
    for (const role of staffRoles) for (const group of visibleNavigationGroups(role)) expect(group.links.length).toBeGreaterThan(0);
  });
});
