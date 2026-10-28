import "server-only";

import type { StaffContext } from "@/lib/exchange/staff";
import { can, isStaffRole, type StaffRole } from "@/lib/exchange/permissions";
import { isMissingSchemaError } from "@/lib/exchange/schema";
import { detectConflicts, type ConflictCandidate } from "./conflicts";
import {
  bookingEnd,
  customerDisplayName,
  mapAppointment,
  mapBooking,
  relation,
  saleVehicleLabel,
  sortEntries,
  type AppointmentRow,
  type BookingRow,
  type CustomerRelation,
  type SaleVehicleRelation,
} from "./mapping";
import type { DiaryEntry } from "./types";

export type DbClient = StaffContext["client"];

export type StaffMember = { id: string; name: string; role: StaffRole };

export const appointmentSelect = "id,kind,status,title,starts_at,ends_at,location,assigned_to,customer_id,sale_vehicle_id,enquiry_id,seller_submission_id,vehicle_sale_id,notes,customer_message,alternative_start,confirmed_at,cancelled_at,cancellation_reason,created_at,updated_at,customers(id,name,email,phone,anonymised_at),sale_vehicles(id,make,model,year,registration,stock_reference,slug,status)";
const bookingColumns = "id,booking_reference,status,service_name,appointment_start,appointment_end,location,location_mode,customer_id,vehicle_id,notes,problem_description,customers(id,name,email,phone,anonymised_at),vehicles(id,make,model,year,registration)";

export async function loadStaffDirectory(client: DbClient): Promise<StaffMember[]> {
  const withRole = await client.from("admin_profiles").select("user_id,display_name,staff_role").order("display_name");
  let rows = withRole.data as Array<{ user_id: string; display_name: string; staff_role?: string }> | null;
  if (withRole.error) {
    const fallback = await client.from("admin_profiles").select("user_id,display_name").order("display_name");
    rows = fallback.data as typeof rows;
  }
  return (rows || []).map((row) => ({ id: row.user_id, name: row.display_name, role: isStaffRole(row.staff_role) ? row.staff_role : "owner" }));
}

export function staffNameMap(staff: StaffMember[]) {
  return new Map(staff.map((member) => [member.id, member.name]));
}

export type DiaryLoadResult = {
  entries: DiaryEntry[];
  /** diary_appointments (or bookings.assigned_to) is not in this database yet. */
  schemaMissing: boolean;
  failed: boolean;
};

async function selectBookings(client: DbClient, startUtc: string, endUtc: string) {
  // Bookings without an end are shown as an hour; look back a day so long
  // bookings that started before the range are still found.
  const lookBack = new Date(Date.parse(startUtc) - 86_400_000).toISOString();
  const query = (columns: string) => client.from("bookings").select(columns).is("deleted_at", null).gte("appointment_start", lookBack).lt("appointment_start", endUtc).order("appointment_start").limit(1000);
  const first = await query(`${bookingColumns},assigned_to`);
  if (!first.error) return { rows: (first.data || []) as unknown as BookingRow[], schemaMissing: false, failed: false };
  if (!isMissingSchemaError(first.error)) return { rows: [], schemaMissing: false, failed: true };
  const second = await query(bookingColumns);
  const rows = ((second.data || []) as unknown as Array<Omit<BookingRow, "assigned_to">>).map((row) => ({ ...row, assigned_to: null }));
  return { rows, schemaMissing: true, failed: Boolean(second.error) };
}

/** Diary appointments and workshop bookings overlapping [startUtc, endUtc), sorted by start. */
export async function loadDiaryEntries(client: DbClient, startUtc: string, endUtc: string, role: StaffRole, staffNames: Map<string, string>): Promise<DiaryLoadResult> {
  const context = { role, staffNames };
  const [appointments, bookings] = await Promise.all([
    client.from("diary_appointments").select(appointmentSelect).is("deleted_at", null).lt("starts_at", endUtc).gt("ends_at", startUtc).order("starts_at").limit(1000),
    selectBookings(client, startUtc, endUtc),
  ]);
  const schemaMissing = isMissingSchemaError(appointments.error) || bookings.schemaMissing;
  const failed = (Boolean(appointments.error) && !isMissingSchemaError(appointments.error)) || bookings.failed;
  const entries: DiaryEntry[] = [];
  for (const row of (appointments.error ? [] : appointments.data || []) as unknown as AppointmentRow[]) entries.push(mapAppointment(row, context));
  for (const row of bookings.rows) {
    if (Date.parse(bookingEnd(row)) <= Date.parse(startUtc)) continue;
    entries.push(mapBooking(row, context));
  }
  return { entries: sortEntries(entries), schemaMissing, failed };
}

/** Everything that overlaps the candidate (with a day either side), then the clashes among them. */
export async function findConflicts(client: DbClient, candidate: ConflictCandidate, role: StaffRole, staffNames: Map<string, string>) {
  const from = new Date(Date.parse(candidate.start) - 86_400_000).toISOString();
  const to = new Date(Date.parse(candidate.end) + 86_400_000).toISOString();
  const { entries } = await loadDiaryEntries(client, from, to, role, staffNames);
  return detectConflicts(candidate, entries);
}

export type AppointmentDetail = AppointmentRow & {
  customer_message: string | null;
  alternative_start: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  conflict_override_reason?: string | null;
  conflict_override_by?: string | null;
  conflict_override_at?: string | null;
  customers: (CustomerRelation & { email?: string | null; phone?: string | null }) | null;
  sale_vehicles: (SaleVehicleRelation & { slug?: string; status?: string }) | null;
};

/** Columns added by migration 20261028090300; read separately so older databases still work. */
const overrideSelect = "conflict_override_reason,conflict_override_by,conflict_override_at";

export async function getAppointment(client: DbClient, id: string): Promise<{ appointment: AppointmentDetail | null; schemaMissing: boolean }> {
  const read = (columns: string) => client.from("diary_appointments").select(columns).eq("id", id).is("deleted_at", null).maybeSingle();
  let { data, error } = await read(`${appointmentSelect},${overrideSelect}`);
  if (error && isMissingSchemaError(error)) ({ data, error } = await read(appointmentSelect));
  if (error) return { appointment: null, schemaMissing: isMissingSchemaError(error) };
  if (!data) return { appointment: null, schemaMissing: false };
  const row = data as unknown as AppointmentDetail;
  return { appointment: { ...row, customers: relation(row.customers), sale_vehicles: relation(row.sale_vehicles) }, schemaMissing: false };
}

export type BookingDetail = BookingRow & {
  problem_description: string | null;
  customers: (CustomerRelation & { email?: string | null; phone?: string | null }) | null;
};

export async function getBookingForDiary(client: DbClient, id: string): Promise<{ booking: BookingDetail | null; schemaMissing: boolean }> {
  const first = await client.from("bookings").select(`${bookingColumns},assigned_to`).eq("id", id).is("deleted_at", null).maybeSingle();
  let data = first.data as unknown as BookingDetail | null;
  let schemaMissing = false;
  if (first.error) {
    if (!isMissingSchemaError(first.error)) return { booking: null, schemaMissing: false };
    schemaMissing = true;
    const second = await client.from("bookings").select(bookingColumns).eq("id", id).is("deleted_at", null).maybeSingle();
    data = second.data ? { ...(second.data as unknown as BookingDetail), assigned_to: null } : null;
  }
  if (!data) return { booking: null, schemaMissing };
  return { booking: { ...data, customers: relation(data.customers), vehicles: relation(data.vehicles) }, schemaMissing };
}

// ---------------------------------------------------------------------------
// Link pickers: vehicle, customer, enquiry, seller submission, vehicle sale.
// Searches arrive in a POST body (server action), never in a URL.
// ---------------------------------------------------------------------------

export const linkKinds = ["vehicle", "customer", "enquiry", "submission", "sale"] as const;
export type LinkKind = (typeof linkKinds)[number];
export type LinkOption = { id: string; label: string; detail?: string };

export function canUseLink(role: StaffRole, kind: LinkKind) {
  if (kind === "vehicle") return can(role, "exchange.view");
  if (kind === "customer") return can(role, "customers.view");
  if (kind === "submission") return can(role, "buying.manage");
  return can(role, "sales.manage");
}

/** Characters with meaning in PostgREST filters or LIKE patterns are dropped. */
export function sanitiseSearch(value: string) {
  return value.replace(/[%_,()*\\:"'`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

type VehicleRow = SaleVehicleRelation & { id: string; status?: string };
type EnquiryRow = { id: string; type: string; created_at: string; customer_id: string | null; sale_vehicle_id: string | null; customers: CustomerRelation | CustomerRelation[] | null; sale_vehicles: SaleVehicleRelation | SaleVehicleRelation[] | null };
type SubmissionRow = { id: string; reference: string; make: string | null; model: string | null; year: number | null; customer_id: string; enquiry_id: string | null; customers: CustomerRelation | CustomerRelation[] | null };
type SaleRow = { id: string; status: string; customer_id: string | null; enquiry_id: string | null; sale_vehicle_id: string; customers: CustomerRelation | CustomerRelation[] | null; sale_vehicles: SaleVehicleRelation | SaleVehicleRelation[] | null };

function vehicleOption(row: VehicleRow): LinkOption {
  return { id: row.id, label: saleVehicleLabel(row) || "Vehicle", detail: row.status ? statusWord(row.status) : undefined };
}

function statusWord(value: string) {
  return value === "archived" ? "Withdrawn" : value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function enquiryOption(row: EnquiryRow): LinkOption {
  const vehicle = saleVehicleLabel(relation(row.sale_vehicles));
  return { id: row.id, label: customerDisplayName(relation(row.customers)) || "Customer", detail: [row.type === "vehicle_purchase" ? "Buying enquiry" : "Sales enquiry", vehicle].filter(Boolean).join(" · ") };
}

function submissionOption(row: SubmissionRow): LinkOption {
  const vehicle = [row.year, row.make, row.model].filter(Boolean).join(" ");
  return { id: row.id, label: `${row.reference}${vehicle ? ` · ${vehicle}` : ""}`, detail: customerDisplayName(relation(row.customers)) || undefined };
}

function saleOption(row: SaleRow): LinkOption {
  return { id: row.id, label: saleVehicleLabel(relation(row.sale_vehicles)) || "Vehicle sale", detail: [customerDisplayName(relation(row.customers)), statusWord(row.status)].filter(Boolean).join(" · ") };
}

const vehicleColumns = "id,make,model,year,registration,stock_reference,status";
const enquiryColumns = "id,type,created_at,customer_id,sale_vehicle_id,customers(name,anonymised_at),sale_vehicles(make,model,year,stock_reference)";
const submissionColumns = "id,reference,make,model,year,customer_id,enquiry_id,customers(name,anonymised_at)";
const saleColumns = "id,status,customer_id,enquiry_id,sale_vehicle_id,customers(name,anonymised_at),sale_vehicles(make,model,year,stock_reference)";

export async function searchLinks(client: DbClient, kind: LinkKind, rawQuery: string): Promise<LinkOption[]> {
  const query = sanitiseSearch(rawQuery);
  const pattern = `%${query}%`;
  if (kind === "vehicle") {
    let request = client.from("sale_vehicles").select(vehicleColumns).is("deleted_at", null).order("updated_at", { ascending: false }).limit(12);
    if (query) request = request.or(`make.ilike.${pattern},model.ilike.${pattern},stock_reference.ilike.${pattern},registration.ilike.${pattern.replace(/\s/g, "")}`);
    const { data } = await request;
    return ((data || []) as unknown as VehicleRow[]).map(vehicleOption);
  }
  if (kind === "customer") {
    let request = client.from("customers").select("id,name,anonymised_at,created_at").is("anonymised_at", null).order("created_at", { ascending: false }).limit(12);
    if (query) request = request.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`);
    const { data } = await request;
    return ((data || []) as Array<{ id: string; name: string; created_at: string }>).map((row) => ({ id: row.id, label: row.name, detail: `Added ${new Date(row.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}` }));
  }
  if (kind === "enquiry") {
    let customerIds: string[] | null = null;
    if (query) customerIds = await matchingCustomerIds(client, pattern);
    let request = client.from("enquiries").select(enquiryColumns).is("deleted_at", null).in("type", ["vehicle_sales", "vehicle_purchase"]).order("created_at", { ascending: false }).limit(12);
    if (customerIds) request = request.in("customer_id", customerIds.length ? customerIds : ["00000000-0000-0000-0000-000000000000"]);
    const { data } = await request;
    return ((data || []) as unknown as EnquiryRow[]).map(enquiryOption);
  }
  if (kind === "submission") {
    let request = client.from("seller_submissions").select(submissionColumns).order("created_at", { ascending: false }).limit(12);
    if (query) request = request.or(`reference.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern}`);
    const { data } = await request;
    return ((data || []) as unknown as SubmissionRow[]).map(submissionOption);
  }
  let request = client.from("vehicle_sales").select(saleColumns).neq("status", "cancelled").order("updated_at", { ascending: false }).limit(12);
  if (query) {
    const vehicles = await client.from("sale_vehicles").select("id").or(`make.ilike.${pattern},model.ilike.${pattern},stock_reference.ilike.${pattern}`).limit(50);
    const ids = ((vehicles.data || []) as Array<{ id: string }>).map((row) => row.id);
    request = request.in("sale_vehicle_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data } = await request;
  return ((data || []) as unknown as SaleRow[]).map(saleOption);
}

async function matchingCustomerIds(client: DbClient, pattern: string) {
  const { data } = await client.from("customers").select("id").or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`).limit(50);
  return ((data || []) as Array<{ id: string }>).map((row) => row.id);
}

export type LinkSelection = Partial<Record<LinkKind, LinkOption | null>>;

/**
 * Labels for linked records, used to prefill the form from query parameters
 * (ids only) and to show existing links. Linked customer, vehicle and sale are
 * filled in from an enquiry, submission or sale when not given directly.
 */
export async function resolveLinks(client: DbClient, ids: Partial<Record<LinkKind, string | null>>): Promise<LinkSelection & { suggestedKind?: string }> {
  const result: LinkSelection & { suggestedKind?: string } = {};
  const resolved = { ...ids };
  if (resolved.sale) {
    const { data } = await client.from("vehicle_sales").select(saleColumns).eq("id", resolved.sale).maybeSingle();
    if (data) {
      const row = data as unknown as SaleRow;
      result.sale = saleOption(row);
      resolved.vehicle ||= row.sale_vehicle_id;
      resolved.customer ||= row.customer_id;
      resolved.enquiry ||= row.enquiry_id;
      result.suggestedKind ??= "handover";
    }
  }
  if (resolved.submission) {
    const { data } = await client.from("seller_submissions").select(submissionColumns).eq("id", resolved.submission).maybeSingle();
    if (data) {
      const row = data as unknown as SubmissionRow;
      result.submission = submissionOption(row);
      resolved.customer ||= row.customer_id;
      result.suggestedKind ??= "purchase_inspection";
    }
  }
  if (resolved.enquiry) {
    const { data } = await client.from("enquiries").select(enquiryColumns).eq("id", resolved.enquiry).maybeSingle();
    if (data) {
      const row = data as unknown as EnquiryRow;
      result.enquiry = enquiryOption(row);
      resolved.customer ||= row.customer_id;
      resolved.vehicle ||= row.sale_vehicle_id;
      result.suggestedKind ??= row.type === "vehicle_sales" ? "viewing" : "purchase_inspection";
    }
  }
  if (resolved.vehicle) {
    const { data } = await client.from("sale_vehicles").select(vehicleColumns).eq("id", resolved.vehicle).maybeSingle();
    if (data) result.vehicle = vehicleOption(data as unknown as VehicleRow);
  }
  if (resolved.customer) {
    const { data } = await client.from("customers").select("id,name,anonymised_at").eq("id", resolved.customer).maybeSingle();
    if (data) {
      const row = data as { id: string; name: string; anonymised_at: string | null };
      result.customer = { id: row.id, label: customerDisplayName(row) || "Customer" };
    }
  }
  return result;
}
