import "server-only";

import { sanitiseSearch, type DbClient } from "@/lib/diary/repository";
import { isMissingSchemaError } from "@/lib/exchange/schema";

// Customers are created per enquiry, booking or seller submission, so the
// same person can appear more than once. This module only reads; it never
// merges or edits customer records.

export type CustomerSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredContact: string | null;
  anonymised: boolean;
  createdAt: string;
};

type CustomerRow = { id: string; name: string; email: string | null; phone: string | null; preferred_contact: string | null; anonymised_at: string | null; created_at: string };

const customerColumns = "id,name,email,phone,preferred_contact,anonymised_at,created_at";

export function toSummary(row: CustomerRow): CustomerSummary {
  const anonymised = Boolean(row.anonymised_at);
  return {
    id: row.id,
    name: anonymised ? "Anonymised" : row.name,
    email: anonymised ? null : row.email,
    phone: anonymised || row.phone === "REDACTED" ? null : row.phone,
    preferredContact: anonymised ? null : row.preferred_contact,
    anonymised,
    createdAt: row.created_at,
  };
}

export async function listRecentCustomers(client: DbClient, limit = 30) {
  const { data, error } = await client.from("customers").select(customerColumns).order("created_at", { ascending: false }).limit(limit);
  return { customers: ((data || []) as CustomerRow[]).map(toSummary), failed: Boolean(error) };
}

/** Name, email or phone contains the query. Anonymised customers never match. */
export async function searchCustomers(client: DbClient, raw: string, limit = 40) {
  const query = sanitiseSearch(raw);
  if (query.length < 2) return [];
  const pattern = `%${query}%`;
  const digits = query.replace(/\D/g, "");
  const filters = [`name.ilike.${pattern}`, `email.ilike.${pattern}`, `phone.ilike.${pattern}`];
  if (digits.length >= 4 && digits !== query) filters.push(`phone.ilike.%${digits}%`);
  const { data } = await client.from("customers").select(customerColumns).is("anonymised_at", null).or(filters.join(",")).order("created_at", { ascending: false }).limit(limit);
  return ((data || []) as CustomerRow[]).map(toSummary);
}

export type CustomerEnquiry = { id: string; type: string; status: string; salesStage: string | null; createdAt: string; vehicle: string | null; href: string };
export type CustomerSubmission = { id: string; reference: string; status: string; vehicle: string; createdAt: string; href: string };
export type CustomerBooking = { id: string; reference: string; service: string; status: string; start: string; vehicle: string | null; href: string };
export type CustomerSale = { id: string; status: string; vehicle: string | null; reservedAt: string; href: string };
export type CustomerAppointment = { id: string; kind: string; status: string; title: string; start: string; end: string; href: string };

export type CustomerDetail = {
  customer: CustomerSummary;
  enquiries: CustomerEnquiry[];
  submissions: CustomerSubmission[];
  bookings: CustomerBooking[];
  sales: CustomerSale[];
  appointments: CustomerAppointment[];
  schemaMissing: boolean;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function vehicleName(vehicle: { year?: number | null; make?: string | null; model?: string | null; stock_reference?: string | null } | null) {
  if (!vehicle) return null;
  return [[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" "), vehicle.stock_reference].filter(Boolean).join(" · ") || null;
}

export function enquiryHref(type: string, id: string, submissionId?: string | null) {
  if (type === "vehicle_sales") return `/admin/exchange/sales/${id}`;
  if (type === "vehicle_purchase" && submissionId) return `/admin/exchange/buying/${submissionId}`;
  return `/admin/enquiries/${id}`;
}

export async function getCustomerDetail(client: DbClient, id: string): Promise<CustomerDetail | null> {
  const { data: customerRow } = await client.from("customers").select(customerColumns).eq("id", id).maybeSingle();
  if (!customerRow) return null;

  const [enquiries, submissions, bookings, sales, appointments] = await Promise.all([
    client.from("enquiries").select("id,type,status,sales_stage,created_at,sale_vehicles(year,make,model,stock_reference),vehicles(make,model)").eq("customer_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
    client.from("seller_submissions").select("id,reference,status,year,make,model,enquiry_id,created_at").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
    client.from("bookings").select("id,booking_reference,service_name,status,appointment_start,vehicles(make,model)").eq("customer_id", id).is("deleted_at", null).order("appointment_start", { ascending: false }).limit(100),
    client.from("vehicle_sales").select("id,status,reserved_at,sale_vehicles(year,make,model,stock_reference)").eq("customer_id", id).order("reserved_at", { ascending: false }).limit(100),
    client.from("diary_appointments").select("id,kind,status,title,starts_at,ends_at").eq("customer_id", id).is("deleted_at", null).order("starts_at", { ascending: false }).limit(100),
  ]);
  const schemaMissing = [enquiries.error, submissions.error, sales.error, appointments.error].some(isMissingSchemaError);

  let enquiryRows = (enquiries.data || []) as Array<{ id: string; type: string; status: string; sales_stage?: string | null; created_at: string; sale_vehicles?: unknown; vehicles: unknown }>;
  if (enquiries.error && isMissingSchemaError(enquiries.error)) {
    const fallback = await client.from("enquiries").select("id,type,status,created_at,vehicles(make,model)").eq("customer_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
    enquiryRows = (fallback.data || []) as typeof enquiryRows;
  }
  const submissionRows = (submissions.error ? [] : submissions.data || []) as Array<{ id: string; reference: string; status: string; year: number | null; make: string | null; model: string | null; enquiry_id: string | null; created_at: string }>;
  const submissionByEnquiry = new Map(submissionRows.filter((row) => row.enquiry_id).map((row) => [row.enquiry_id as string, row.id]));

  return {
    customer: toSummary(customerRow as CustomerRow),
    schemaMissing,
    enquiries: enquiryRows.map((row) => {
      const stock = one(row.sale_vehicles as never) as Parameters<typeof vehicleName>[0];
      const workshop = one(row.vehicles as never) as { make: string | null; model: string | null } | null;
      return {
        id: row.id,
        type: row.type,
        status: row.status,
        salesStage: row.sales_stage ?? null,
        createdAt: row.created_at,
        vehicle: vehicleName(stock) ?? ([workshop?.make, workshop?.model].filter(Boolean).join(" ") || null),
        href: enquiryHref(row.type, row.id, submissionByEnquiry.get(row.id)),
      };
    }),
    submissions: submissionRows.map((row) => ({ id: row.id, reference: row.reference, status: row.status, vehicle: [row.year, row.make, row.model].filter(Boolean).join(" ") || "Vehicle not given", createdAt: row.created_at, href: `/admin/exchange/buying/${row.id}` })),
    bookings: ((bookings.data || []) as Array<{ id: string; booking_reference: string; service_name: string; status: string; appointment_start: string; vehicles: unknown }>).map((row) => {
      const vehicle = one(row.vehicles as never) as { make: string | null; model: string | null } | null;
      return { id: row.id, reference: row.booking_reference, service: row.service_name, status: row.status, start: row.appointment_start, vehicle: [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || null, href: `/admin/bookings/${row.id}` };
    }),
    sales: ((sales.error ? [] : sales.data || []) as Array<{ id: string; status: string; reserved_at: string; sale_vehicles: unknown }>).map((row) => ({ id: row.id, status: row.status, reservedAt: row.reserved_at, vehicle: vehicleName(one(row.sale_vehicles as never)), href: `/admin/exchange/handover/${row.id}` })),
    appointments: ((appointments.error ? [] : appointments.data || []) as Array<{ id: string; kind: string; status: string; title: string; starts_at: string; ends_at: string }>).map((row) => ({ id: row.id, kind: row.kind, status: row.status, title: row.title, start: row.starts_at, end: row.ends_at, href: `/admin/diary/${row.id}` })),
  };
}
