// Display helpers for SOB Auto Exchange. Pure functions shared by server and
// client components. Unknown values always read "Not confirmed": never
// replace them with a reassuring guess.

import { NOT_CONFIRMED } from "@/config/exchange";
import type { ListingCondition, SaleVehicle, SaleVehicleStatus, ServiceHistoryStatus, WriteOffStatus } from "@/types/domain";

export const LONDON_TIME_ZONE = "Europe/London";

export function vehicleName(vehicle: Pick<SaleVehicle, "year" | "make" | "model">) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
}

export function vehicleTitle(vehicle: Pick<SaleVehicle, "make" | "model">) {
  return `${vehicle.make} ${vehicle.model}`;
}

export function formatPrice(pounds: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pounds);
}

export function formatMileage(miles: number) {
  return `${miles.toLocaleString("en-GB")} miles`;
}

/** "14 June 2027" for a YYYY-MM-DD or ISO string; NOT_CONFIRMED when missing or invalid. */
export function formatDate(value?: string | null) {
  if (!value) return NOT_CONFIRMED;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return NOT_CONFIRMED;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: LONDON_TIME_ZONE }).format(date);
}

/** "Saturday 31 October 2026 at 11:00" in UK time. */
export function formatDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: LONDON_TIME_ZONE }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: LONDON_TIME_ZONE }).format(date);
  return `${day} at ${time}`;
}

export function orNotConfirmed(value: string | number | null | undefined) {
  if (value === null || value === undefined) return NOT_CONFIRMED;
  const text = String(value).trim();
  return text ? text : NOT_CONFIRMED;
}

export type AvailabilityTone = "available" | "reserved" | "sold" | "withdrawn";

export function availability(status: SaleVehicleStatus): { label: string; tone: AvailabilityTone } {
  if (status === "available") return { label: "Available", tone: "available" };
  if (status === "reserved") return { label: "Reserved", tone: "reserved" };
  if (status === "sold") return { label: "Sold", tone: "sold" };
  return { label: "Withdrawn", tone: "withdrawn" };
}

export const listingConditionLabels: Record<ListingCondition, string> = {
  ready_to_drive: "Ready to drive",
  repair_project: "Repair project",
};

export const writeOffLabels: Record<WriteOffStatus, string> = {
  not_confirmed: NOT_CONFIRMED,
  none_recorded: "No insurance write-off recorded",
  cat_s: "Recorded write-off: Category S (structural damage, repaired)",
  cat_n: "Recorded write-off: Category N (non-structural damage, repaired)",
  cat_c: "Recorded write-off: Category C (older category)",
  cat_d: "Recorded write-off: Category D (older category)",
  other_recorded: "Insurance write-off recorded (category to be confirmed)",
};

/** Short badge text for cards. Null when there is no write-off on record. */
export function writeOffBadge(status: WriteOffStatus) {
  switch (status) {
    case "cat_s": return "Cat S recorded";
    case "cat_n": return "Cat N recorded";
    case "cat_c": return "Cat C recorded";
    case "cat_d": return "Cat D recorded";
    case "other_recorded": return "Write-off recorded";
    default: return null;
  }
}

export const serviceHistoryLabels: Record<ServiceHistoryStatus, string> = {
  not_confirmed: NOT_CONFIRMED,
  full: "Full service history",
  partial: "Partial service history",
  none: "No service history",
};

/** Whether a listing carries a disclosure the buyer must see before anything else. */
export function hasProminentDisclosure(vehicle: Pick<SaleVehicle, "listingCondition" | "writeOffStatus">) {
  return vehicle.listingCondition === "repair_project" || writeOffBadge(vehicle.writeOffStatus) !== null;
}
