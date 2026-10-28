// Labels and option lists for Vehicle Buying & Selling. Client-safe: no data
// access, no secrets. Status values match the database check constraints in
// supabase/migrations/20261028090100_auto_exchange.sql.

import type { SaleVehicleStatus } from "@/types/domain";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

export const stockStatusLabels: Record<SaleVehicleStatus, string> = {
  draft: "Draft",
  preparation: "Preparation",
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  archived: "Withdrawn",
};

export const stockStatusTones: Record<SaleVehicleStatus, Tone> = {
  draft: "neutral",
  preparation: "info",
  available: "success",
  reserved: "warning",
  sold: "danger",
  archived: "muted",
};

export const stockStatusOrder: SaleVehicleStatus[] = ["draft", "preparation", "available", "reserved", "sold", "archived"];

export const listingConditionLabels = { ready_to_drive: "Ready to drive", repair_project: "Repair project" } as const;

export const writeOffLabels = {
  not_confirmed: "Not confirmed",
  none_recorded: "No write-off recorded",
  cat_s: "Category S",
  cat_n: "Category N",
  cat_c: "Category C",
  cat_d: "Category D",
  other_recorded: "Other write-off recorded",
} as const;

export const serviceHistoryLabels = { not_confirmed: "Not confirmed", full: "Full", partial: "Partial", none: "None" } as const;

export const submissionStatuses = ["new", "reviewing", "provisional_offer", "inspection", "final_offer", "purchased", "declined", "closed"] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];
export const submissionStatusLabels: Record<SubmissionStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  provisional_offer: "Provisional offer",
  inspection: "Inspection",
  final_offer: "Final offer",
  purchased: "Purchased",
  declined: "Declined",
  closed: "Closed",
};
export const submissionStatusTones: Record<SubmissionStatus, Tone> = {
  new: "info",
  reviewing: "neutral",
  provisional_offer: "warning",
  inspection: "warning",
  final_offer: "warning",
  purchased: "success",
  declined: "danger",
  closed: "muted",
};
/** Pipeline stages that count as a "qualified" seller enquiry in reports. */
export const qualifiedSubmissionStatuses: SubmissionStatus[] = ["provisional_offer", "inspection", "final_offer", "purchased"];
export const openSubmissionStatuses: SubmissionStatus[] = ["new", "reviewing", "provisional_offer", "inspection", "final_offer"];

export const runningStatusLabels = { runs_and_drives: "Runs and drives", runs_not_driveable: "Runs, not driveable", does_not_run: "Does not run", not_sure: "Not sure" } as const;
export const sellerMotLabels = { valid: "Valid", expired: "Expired", not_sure: "Not sure" } as const;
export const sellerServiceHistoryLabels = { full: "Full", partial: "Partial", none: "None", not_sure: "Not sure" } as const;
export const financeLabels = { yes: "Yes", no: "No", not_sure: "Not sure" } as const;
export const preferredContactLabels = { phone: "Phone", whatsapp: "WhatsApp", email: "Email" } as const;

export const salesStages = ["new", "contacted", "viewing_booked", "negotiating", "reserved", "sold", "lost"] as const;
export type SalesStage = (typeof salesStages)[number];
export const salesStageLabels: Record<SalesStage, string> = {
  new: "New",
  contacted: "Contacted",
  viewing_booked: "Viewing booked",
  negotiating: "Negotiating",
  reserved: "Reserved",
  sold: "Sold",
  lost: "Lost",
};
export const salesStageTones: Record<SalesStage, Tone> = {
  new: "info",
  contacted: "neutral",
  viewing_booked: "info",
  negotiating: "warning",
  reserved: "warning",
  sold: "success",
  lost: "muted",
};

export const vehicleSaleStatuses = ["reserved", "awaiting_payment", "ready_for_handover", "completed", "cancelled"] as const;
export type VehicleSaleStatus = (typeof vehicleSaleStatuses)[number];
export const vehicleSaleStatusLabels: Record<VehicleSaleStatus, string> = {
  reserved: "Reserved",
  awaiting_payment: "Awaiting payment",
  ready_for_handover: "Ready for handover",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const vehicleSaleStatusTones: Record<VehicleSaleStatus, Tone> = {
  reserved: "warning",
  awaiting_payment: "warning",
  ready_for_handover: "info",
  completed: "success",
  cancelled: "muted",
};
export const activeSaleStatuses: VehicleSaleStatus[] = ["reserved", "awaiting_payment", "ready_for_handover"];

export const paymentStatuses = ["not_started", "deposit_received", "part_paid", "paid_in_full", "refunded"] as const;
export const paymentStatusLabels: Record<(typeof paymentStatuses)[number], string> = {
  not_started: "Not started",
  deposit_received: "Deposit received",
  part_paid: "Part paid",
  paid_in_full: "Paid in full",
  refunded: "Refunded",
};
export const handoverMethodLabels = { collection: "Collection", delivery: "Delivery", not_decided: "Not decided" } as const;

export const prepStatuses = ["todo", "in_progress", "done", "not_required"] as const;
export type PrepStatus = (typeof prepStatuses)[number];
export const prepStatusLabels: Record<PrepStatus, string> = { todo: "To do", in_progress: "In progress", done: "Done", not_required: "Not required" };
export const prepStatusTones: Record<PrepStatus, Tone> = { todo: "neutral", in_progress: "info", done: "success", not_required: "muted" };
export const prepCategories = ["check", "fault", "repair", "valet", "photos", "documents", "other"] as const;
export const prepCategoryLabels: Record<(typeof prepCategories)[number], string> = { check: "Check", fault: "Fault", repair: "Repair", valet: "Valet", photos: "Photos", documents: "Documents", other: "Other" };

export const inspectionOutcomes = ["recorded", "satisfactory", "advisories", "not_satisfactory"] as const;
export const inspectionOutcomeLabels: Record<(typeof inspectionOutcomes)[number], string> = { recorded: "Recorded", satisfactory: "Satisfactory", advisories: "Advisories", not_satisfactory: "Not satisfactory" };

export const documentKinds = ["registration_document", "service_record", "mot_certificate", "inspection_report", "purchase_invoice", "sale_invoice", "history_check", "other"] as const;
export const documentKindLabels: Record<(typeof documentKinds)[number], string> = {
  registration_document: "Registration document (V5C)",
  service_record: "Service record",
  mot_certificate: "MOT certificate",
  inspection_report: "Inspection report",
  purchase_invoice: "Purchase invoice",
  sale_invoice: "Sale invoice",
  history_check: "History check",
  other: "Other",
};

export const acquisitionSources = ["customer_purchase", "part_exchange", "trade", "auction", "other"] as const;
export const acquisitionSourceLabels: Record<(typeof acquisitionSources)[number], string> = { customer_purchase: "Bought from a customer", part_exchange: "Part exchange", trade: "Trade", auction: "Auction", other: "Other" };

export const costCategories = ["purchase", "transport", "preparation", "repair", "parts", "valeting", "fees", "other"] as const;

export function label<T extends string>(labels: Record<T, string>, value: string | null | undefined, fallback = "Not confirmed") {
  return value && value in labels ? labels[value as T] : fallback;
}

export function vehicleTitle(vehicle: { year?: number | null; make?: string | null; model?: string | null } | null | undefined) {
  if (!vehicle) return "Vehicle";
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle";
}

const london = "Europe/London";
export function formatDate(value: string | null | undefined, fallback = "Not set") {
  if (!value) return fallback;
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: london }).format(date);
}
export function formatDateTime(value: string | null | undefined, fallback = "Not set") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: london }).format(date);
}
export function formatPounds(pounds: number | null | undefined) {
  if (pounds == null) return "Not set";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pounds);
}
/** For a <input type="datetime-local"> value in the workshop's time zone. */
export function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: london, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function penceToInput(pence: number | null | undefined) {
  if (pence == null) return "";
  return (pence / 100).toFixed(pence % 100 === 0 ? 0 : 2);
}
