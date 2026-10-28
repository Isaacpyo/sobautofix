// Maps diary_appointments and workshop bookings rows onto one DiaryEntry
// shape. Bookings are read straight from public.bookings and never copied
// (docs/exchange/DECISIONS.md D4). Visibility rules for each staff role are
// applied here so no page can forget them.

import { can, type StaffRole } from "@/lib/exchange/permissions";
import {
  appointmentStatusLabels,
  bookingStatusLabels,
  bookingStatusToAppointmentStatus,
  diaryTypeLabels,
  isAppointmentKind,
  isAppointmentStatus,
  workshopKindsWithNotes,
  type AppointmentKind,
  type AppointmentStatus,
  type DiaryEntry,
  type DiaryEntryType,
  type WorkshopBookingStatus,
} from "./types";

type Relation<T> = T | T[] | null | undefined;

export type CustomerRelation = { id?: string; name: string | null; anonymised_at?: string | null };
export type SaleVehicleRelation = { id?: string; make: string | null; model: string | null; year: number | null; registration?: string | null; stock_reference?: string | null };
export type WorkshopVehicleRelation = { id?: string; make: string | null; model: string | null; year?: number | null; registration: string | null };

export type AppointmentRow = {
  id: string;
  kind: string;
  status: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  assigned_to: string | null;
  customer_id: string | null;
  sale_vehicle_id: string | null;
  enquiry_id: string | null;
  seller_submission_id: string | null;
  vehicle_sale_id: string | null;
  notes: string | null;
  customers?: Relation<CustomerRelation>;
  sale_vehicles?: Relation<SaleVehicleRelation>;
};

export type BookingRow = {
  id: string;
  booking_reference: string;
  status: WorkshopBookingStatus;
  service_name: string;
  appointment_start: string;
  appointment_end: string | null;
  location: string | null;
  location_mode: "workshop" | "mobile" | null;
  assigned_to: string | null;
  customer_id: string | null;
  vehicle_id: string | null;
  notes: string | null;
  customers?: Relation<CustomerRelation>;
  vehicles?: Relation<WorkshopVehicleRelation>;
};

export type DiaryMappingContext = {
  role: StaffRole;
  staffNames: Map<string, string>;
};

/** Workshop bookings without an end time are shown as one hour. */
export const DEFAULT_BOOKING_MINUTES = 60;

export function relation<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function customerDisplayName(customer: CustomerRelation | null) {
  if (!customer) return null;
  if (customer.anonymised_at) return "Anonymised";
  return customer.name?.trim() || null;
}

export function saleVehicleLabel(vehicle: SaleVehicleRelation | null) {
  if (!vehicle) return null;
  const name = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return [name, vehicle.stock_reference].filter(Boolean).join(" · ") || null;
}

export function workshopVehicleLabel(vehicle: WorkshopVehicleRelation | null) {
  if (!vehicle) return null;
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const registration = vehicle.registration ? vehicle.registration.replace(/\s+/g, "").toUpperCase() : null;
  return [name, registration].filter(Boolean).join(" · ") || null;
}

export type DiaryLink = { href: string; label: string };

/** Links from an appointment to the records it belongs to, limited to what the role may open. */
export function appointmentLinks(row: Pick<AppointmentRow, "vehicle_sale_id" | "seller_submission_id" | "enquiry_id" | "sale_vehicle_id" | "customer_id">, role: StaffRole): DiaryLink[] {
  const links: DiaryLink[] = [];
  if (row.vehicle_sale_id && can(role, "sales.manage")) links.push({ href: `/admin/exchange/handover/${row.vehicle_sale_id}`, label: "Sale and handover" });
  if (row.seller_submission_id && can(role, "buying.manage")) links.push({ href: `/admin/exchange/buying/${row.seller_submission_id}`, label: "Buying enquiry" });
  if (row.enquiry_id && can(role, "sales.manage") && !row.seller_submission_id) links.push({ href: `/admin/exchange/sales/${row.enquiry_id}`, label: "Sales enquiry" });
  if (row.sale_vehicle_id && can(role, "exchange.view")) links.push({ href: `/admin/exchange/stock/${row.sale_vehicle_id}`, label: "Stock vehicle" });
  if (row.customer_id && can(role, "customers.view")) links.push({ href: `/admin/customers/${row.customer_id}`, label: "Customer" });
  return links;
}

export function canSeeNotes(role: StaffRole, type: DiaryEntryType) {
  return can(role, "sales.manage") || workshopKindsWithNotes.includes(type);
}

export function mapAppointment(row: AppointmentRow, context: DiaryMappingContext): DiaryEntry {
  const type: AppointmentKind = isAppointmentKind(row.kind) ? row.kind : "other";
  const status: AppointmentStatus = isAppointmentStatus(row.status) ? row.status : "confirmed";
  const links = appointmentLinks(row, context.role);
  return {
    key: `appointment:${row.id}`,
    id: row.id,
    source: "appointment",
    type,
    status,
    statusLabel: appointmentStatusLabels[status],
    title: row.title,
    start: row.starts_at,
    end: row.ends_at,
    location: row.location,
    assignedTo: row.assigned_to,
    assignedName: row.assigned_to ? context.staffNames.get(row.assigned_to) ?? "Former staff member" : null,
    customerId: row.customer_id,
    customerName: customerDisplayName(relation(row.customers)),
    vehicleLabel: saleVehicleLabel(relation(row.sale_vehicles)),
    saleVehicleId: row.sale_vehicle_id,
    workshopVehicleId: null,
    enquiryId: row.enquiry_id,
    sellerSubmissionId: row.seller_submission_id,
    vehicleSaleId: row.vehicle_sale_id,
    notes: canSeeNotes(context.role, type) ? row.notes : null,
    reference: null,
    sourceHref: links[0]?.href ?? null,
    sourceLabel: links[0]?.label ?? null,
    href: `/admin/diary/${row.id}`,
  };
}

export function bookingEnd(row: Pick<BookingRow, "appointment_start" | "appointment_end">) {
  if (row.appointment_end && Date.parse(row.appointment_end) > Date.parse(row.appointment_start)) return row.appointment_end;
  return new Date(Date.parse(row.appointment_start) + DEFAULT_BOOKING_MINUTES * 60_000).toISOString();
}

export function mapBooking(row: BookingRow, context: DiaryMappingContext): DiaryEntry {
  const location = row.location_mode === "mobile" ? row.location || "Mobile visit" : row.location;
  return {
    key: `booking:${row.id}`,
    id: row.id,
    source: "booking",
    type: "workshop_booking",
    status: bookingStatusToAppointmentStatus(row.status),
    statusLabel: bookingStatusLabels[row.status] ?? "Confirmed",
    title: row.service_name,
    start: row.appointment_start,
    end: bookingEnd(row),
    location,
    assignedTo: row.assigned_to,
    assignedName: row.assigned_to ? context.staffNames.get(row.assigned_to) ?? "Former staff member" : null,
    customerId: row.customer_id,
    customerName: customerDisplayName(relation(row.customers)),
    vehicleLabel: workshopVehicleLabel(relation(row.vehicles)),
    saleVehicleId: null,
    workshopVehicleId: row.vehicle_id,
    enquiryId: null,
    sellerSubmissionId: null,
    vehicleSaleId: null,
    notes: canSeeNotes(context.role, "workshop_booking") ? row.notes : null,
    reference: row.booking_reference,
    sourceHref: `/admin/bookings/${row.id}`,
    sourceLabel: "Workshop booking",
    href: `/admin/diary/${row.id}`,
  };
}

export function typeLabel(type: DiaryEntryType) {
  return diaryTypeLabels[type];
}

export type DiaryFilters = {
  type?: DiaryEntryType | "";
  staff?: string | "";
  status?: AppointmentStatus | "";
};

/** "unassigned" is a staff filter value meaning no one is assigned. */
export function filterEntries(entries: DiaryEntry[], filters: DiaryFilters) {
  return entries.filter((entry) => {
    if (filters.type && entry.type !== filters.type) return false;
    if (filters.status && entry.status !== filters.status) return false;
    if (filters.staff === "unassigned" && entry.assignedTo) return false;
    if (filters.staff && filters.staff !== "unassigned" && entry.assignedTo !== filters.staff) return false;
    return true;
  });
}

export function sortEntries(entries: DiaryEntry[]) {
  return [...entries].sort((left, right) => Date.parse(left.start) - Date.parse(right.start) || Date.parse(left.end) - Date.parse(right.end) || left.key.localeCompare(right.key));
}
