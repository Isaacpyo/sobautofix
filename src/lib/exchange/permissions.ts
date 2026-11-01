// Staff permissions for the whole admin: Vehicle Buying & Selling, the Autofix
// Diary, invoices (finance), website content, pricing, website settings and
// staff access. Enforced on the server in every page, action and route; the
// database mirrors the finance, settings and profile rules in RLS
// (current_staff_role()). Enquiries, bookings and notifications are open to
// every active staff member.

export const staffRoles = ["owner", "manager", "sales", "workshop"] as const;
export type StaffRole = (typeof staffRoles)[number];

export const staffRoleLabels: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  sales: "Sales",
  workshop: "Workshop",
};

export const exchangePermissions = [
  "exchange.view",
  "stock.edit",
  "stock.publish",
  "stock.price",
  "finance.view",
  "finance.edit",
  "buying.manage",
  "sales.manage",
  "prep.manage",
  "diary.manage",
  "customers.view",
  "settings.manage",
  "content.manage",
  "pricing.manage",
  "site.manage",
  "staff.manage",
] as const;
export type ExchangePermission = (typeof exchangePermissions)[number];

const matrix: Record<StaffRole, readonly ExchangePermission[]> = {
  owner: exchangePermissions,
  manager: exchangePermissions.filter((permission) => !(["settings.manage", "site.manage", "staff.manage"] as ExchangePermission[]).includes(permission)),
  sales: ["exchange.view", "stock.edit", "buying.manage", "sales.manage", "diary.manage", "customers.view"],
  workshop: ["exchange.view", "prep.manage", "diary.manage"],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (staffRoles as readonly string[]).includes(value);
}

export function can(role: StaffRole, permission: ExchangePermission) {
  return matrix[role].includes(permission);
}

export function permissionsFor(role: StaffRole): ExchangePermission[] {
  return [...matrix[role]];
}

export const permissionDescriptions: Record<ExchangePermission, string> = {
  "exchange.view": "Open Vehicle Buying & Selling",
  "stock.edit": "Create and edit stock listings and photos",
  "stock.publish": "Publish, withdraw and relist vehicles",
  "stock.price": "Change advertised prices",
  "finance.view": "See invoices, purchase prices, costs and margins",
  "finance.edit": "Create and send invoices; record costs, purchases and payments",
  "buying.manage": "Work buying enquiries and record offers to sellers",
  "sales.manage": "Work sales enquiries and reservations",
  "prep.manage": "Record preparation, inspections and documents",
  "diary.manage": "Create and change diary appointments",
  "customers.view": "See customer contact details",
  "settings.manage": "Change Vehicle Buying & Selling settings and notification recipients",
  "content.manage": "Edit website pages, news, media and reviews, and restore from Trash",
  "pricing.manage": "Change offers, prices and the service catalogue",
  "site.manage": "Change website settings",
  "staff.manage": "Invite staff, change roles and remove access",
};
