// Staff permissions for Vehicle Buying & Selling and the Autofix Diary.
// Enforced on the server in every page, action and route; the database
// mirrors the finance and settings rules in RLS (current_staff_role()).

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
] as const;
export type ExchangePermission = (typeof exchangePermissions)[number];

const matrix: Record<StaffRole, readonly ExchangePermission[]> = {
  owner: exchangePermissions,
  manager: exchangePermissions.filter((permission) => permission !== "settings.manage"),
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
  "finance.view": "See purchase costs, offers and margins",
  "finance.edit": "Record costs, offers and sale payments",
  "buying.manage": "Work buying enquiries",
  "sales.manage": "Work sales enquiries and reservations",
  "prep.manage": "Record preparation, inspections and documents",
  "diary.manage": "Create and change diary appointments",
  "customers.view": "See customer contact details",
  "settings.manage": "Change settings, notification recipients and staff roles",
};
