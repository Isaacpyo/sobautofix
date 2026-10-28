import "server-only";

import { z } from "zod";
import { createInitialEnquiryMessage } from "@/lib/enquiries/thread-repository";
import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { normalizeRegistration } from "@/lib/vehicle/registration-format";
import { assertCan, ExchangeUserError, fieldError, formText, mustRow, optionalInt, optionalText } from "./core";

const contactSchema = z.object({
  name: formText("the customer's name", 120, 2),
  email: z.preprocess((value) => (typeof value === "string" && value.trim() ? value.trim().toLowerCase() : undefined), z.string().email("Enter a valid email address, or leave blank.").max(160).optional()).transform((value) => value ?? null),
  phone: z.string({ error: "Enter a phone number." }).trim().regex(/^[+\d][\d\s()-]{6,}$/, "Enter a phone number."),
  preferredContact: z.enum(["phone", "whatsapp", "email"], { error: "Choose how they prefer to be contacted." }),
  notes: formText("what the customer wants", 4000, 5),
});

export const staffSalesEnquirySchema = contactSchema.extend({ vehicleId: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid("Choose a vehicle.").optional()) });

export const staffBuyingEnquirySchema = contactSchema.extend({
  kind: z.enum(["sell", "part_exchange"]),
  interestedVehicleId: z.preprocess((value) => (value === "" ? undefined : value), z.string().uuid().optional()),
  registration: optionalText("registration", 9),
  make: optionalText("make", 60),
  model: optionalText("model", 80),
  year: optionalInt("year", 1885, 2100),
  mileage: optionalInt("mileage", 0, 2_000_000),
  fuelType: optionalText("fuel", 40),
  transmission: optionalText("transmission", 40),
  runningStatus: z.enum(["runs_and_drives", "runs_not_driveable", "does_not_run", "not_sure"]).default("not_sure"),
  knownFaults: optionalText("known faults", 2000),
  postcode: optionalText("postcode", 10),
});

async function createCustomer(staff: StaffContext, input: z.infer<typeof contactSchema>) {
  if (input.preferredContact === "email" && !input.email) fieldError("email", "Add an email address, or choose another contact method.");
  return mustRow(await staff.client.from("customers").insert({ name: input.name, email: input.email, phone: input.phone, preferred_contact: input.preferredContact }).select("id").single(), "The customer could not be saved.").id as string;
}

/**
 * A sales enquiry taken by phone or in person. It joins the same pipeline
 * (source "staff"). No email is sent, so it is not left "pending" for the
 * notification retry job.
 */
export async function createStaffSalesEnquiry(staff: StaffContext, input: z.infer<typeof staffSalesEnquirySchema>) {
  assertCan(staff, "sales.manage", "customers.view");
  const vehicle = input.vehicleId ? mustRow(await staff.client.from("sale_vehicles").select("id,slug").eq("id", input.vehicleId).is("deleted_at", null).maybeSingle(), "That vehicle no longer exists.") : null;
  const customerId = await createCustomer(staff, input);
  const enquiry = await staff.client.from("enquiries").insert({ type: "vehicle_sales", customer_id: customerId, service_slug: vehicle?.slug || null, description: input.notes, status: "new", notification_status: "sent", sale_vehicle_id: vehicle?.id || null, sales_stage: "new", source: "staff", assigned_to: staff.userId }).select("id").single();
  if (enquiry.error || !enquiry.data) {
    await staff.client.from("customers").delete().eq("id", customerId);
    throw new ExchangeUserError("The enquiry could not be saved.");
  }
  await startThread(staff, enquiry.data.id, "vehicle_sales", input);
  await auditStaffAction(staff, "create", "enquiry", enquiry.data.id, { type: "vehicle_sales", source: "staff", vehicleId: vehicle?.id });
  return enquiry.data.id as string;
}

export async function createStaffBuyingEnquiry(staff: StaffContext, input: z.infer<typeof staffBuyingEnquirySchema>) {
  assertCan(staff, "buying.manage", "customers.view");
  const registration = input.registration ? normalizeRegistration(input.registration) : null;
  if (registration && (registration.length < 2 || registration.length > 8)) fieldError("registration", "Check the registration number.");
  if (input.kind === "part_exchange" && !input.interestedVehicleId) fieldError("interestedVehicleId", "Choose the vehicle they want to part exchange towards.");
  const customerId = await createCustomer(staff, input);
  const enquiry = await staff.client.from("enquiries").insert({ type: "vehicle_purchase", customer_id: customerId, description: input.notes, location_postcode: input.postcode?.toUpperCase() || null, status: "new", notification_status: "sent", sale_vehicle_id: input.interestedVehicleId || null, source: "staff", assigned_to: staff.userId }).select("id").single();
  if (enquiry.error || !enquiry.data) {
    await staff.client.from("customers").delete().eq("id", customerId);
    throw new ExchangeUserError("The enquiry could not be saved.");
  }
  const submission = await staff.client.from("seller_submissions").insert({
    kind: input.kind, customer_id: customerId, enquiry_id: enquiry.data.id, interested_vehicle_id: input.kind === "part_exchange" ? input.interestedVehicleId : null, status: "new", assigned_to: staff.userId,
    registration, lookup_source: "manual", make: input.make, model: input.model, year: input.year, mileage: input.mileage, fuel_type: input.fuelType, transmission: input.transmission,
    running_status: input.runningStatus, known_faults: input.knownFaults, postcode: input.postcode?.toUpperCase() || null, preferred_contact: input.preferredContact,
  }).select("id,reference").single();
  if (submission.error || !submission.data) {
    await staff.client.from("enquiries").delete().eq("id", enquiry.data.id);
    await staff.client.from("customers").delete().eq("id", customerId);
    throw new ExchangeUserError("The enquiry could not be saved.");
  }
  await startThread(staff, enquiry.data.id, "vehicle_purchase", input);
  await auditStaffAction(staff, "create", "seller_submission", submission.data.id, { kind: input.kind, source: "staff", reference: submission.data.reference });
  return submission.data.id as string;
}

async function startThread(staff: StaffContext, enquiryId: string, type: string, input: { name: string; email: string | null; notes: string }) {
  try {
    await createInitialEnquiryMessage(enquiryId, { type, customerName: input.name, customerEmail: input.email || undefined, description: `Taken by ${staff.displayName}:\n${input.notes}` });
  } catch {
    // The enquiry is saved; the conversation falls back to the enquiry description.
  }
}

export async function enquiryVehicleOptions(staff: StaffContext, statuses: string[]) {
  const { data } = await staff.client.from("sale_vehicles").select("id,year,make,model,stock_reference,status").is("deleted_at", null).in("status", statuses).order("updated_at", { ascending: false }).limit(200);
  return (data || []).map((row) => ({ value: row.id as string, label: `${row.year} ${row.make} ${row.model} · ${row.stock_reference}${row.status !== "available" ? ` (${row.status})` : ""}` }));
}
