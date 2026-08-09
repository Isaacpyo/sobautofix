import "server-only";

import { randomUUID } from "node:crypto";
import { getResendConfig, sendTransactionalEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/server";
import type { EnquiryRequest } from "./schema";

type NotificationInput = Omit<EnquiryRequest, "turnstileToken">;

export async function createEnquiry(input: EnquiryRequest) {
  const admin = createAdminClient();
  if (!admin) {
    if (process.env.NODE_ENV === "production") throw new Error("Enquiry service is not configured");
    return { id: randomUUID(), persisted: false, notificationStatus: "skipped" as const };
  }

  const { data: customer, error: customerError } = await admin.from("customers").insert({
    name: input.contact.name,
    email: input.contact.email || null,
    phone: input.contact.phone,
    preferred_contact: input.contact.preferredContact,
  }).select("id").single();
  if (customerError) throw new Error("Could not save customer details");

  let vehicleId: string | null = null;
  if (input.vehicle) {
    const { data: vehicle, error } = await admin.from("vehicles").insert({
      customer_id: customer.id,
      registration: input.vehicle.registration,
      make: input.vehicle.make || null,
      model: input.vehicle.model || null,
      derivative: input.vehicle.derivative || null,
      year: input.vehicle.year || null,
      colour: input.vehicle.colour || null,
      fuel_type: input.vehicle.fuelType || null,
      transmission: input.vehicle.transmission || null,
      engine_capacity_cc: input.vehicle.engineCapacityCc || null,
      body_type: input.vehicle.bodyType || null,
    }).select("id").single();
    if (error) throw new Error("Could not save vehicle details");
    vehicleId = vehicle.id;
  }

  const { data: enquiry, error: enquiryError } = await admin.from("enquiries").insert({
    type: input.type,
    customer_id: customer.id,
    vehicle_id: vehicleId,
    service_slug: input.serviceSlug || null,
    description: input.description,
    location_postcode: input.locationPostcode || null,
    driveable: input.driveable ?? null,
  }).select("id").single();
  if (enquiryError) throw new Error("Could not save enquiry");

  const notificationStatus = await sendNotifications(enquiry.id, input);
  await admin.from("enquiries").update({ notification_status: notificationStatus }).eq("id", enquiry.id);
  return { id: enquiry.id, persisted: true, notificationStatus };
}

export async function sendNotifications(enquiryId: string, input: NotificationInput) {
  const emailConfig = getResendConfig();
  const admin = createAdminClient();
  if (!emailConfig) return "failed" as const;
  const details = [
    `Type: ${input.type}`,
    `Name: ${input.contact.name}`,
    `Phone: ${input.contact.phone}`,
    input.contact.email ? `Email: ${input.contact.email}` : "",
    input.vehicle ? `Vehicle: ${[input.vehicle.make, input.vehicle.model, input.vehicle.registration].filter(Boolean).join(" ")}` : "",
    input.locationPostcode ? `Location: ${input.locationPostcode}` : "",
    `Description: ${input.description}`,
  ].filter(Boolean).join("\n");

  try {
    const result = await sendTransactionalEmail({
      to: emailConfig.notificationRecipient,
      subject: `New ${input.type.replace("_", " ")} enquiry`,
      text: details,
      replyTo: input.contact.email || emailConfig.replyTo,
    });
    await admin?.from("notification_attempts").insert({ enquiry_id: enquiryId, recipient_type: "business", status: "sent", provider_id: result.data?.id || null });
    if (input.contact.email) {
      const customerResult = await sendTransactionalEmail({ to: input.contact.email, subject: "We received your SOB Autofix request", text: `Hello ${input.contact.name},\n\nThanks for contacting SOB Autofix. We have received your request and will respond using your preferred contact method.\n\nReference: ${enquiryId}\n\nSOB Autofix Limited` });
      await admin?.from("notification_attempts").insert({ enquiry_id: enquiryId, recipient_type: "customer", status: "sent", provider_id: customerResult.data?.id || null });
    }
    return "sent" as const;
  } catch (error) {
    await admin?.from("notification_attempts").insert({ enquiry_id: enquiryId, recipient_type: "business", status: "failed", error_code: error instanceof Error ? error.name : "unknown" });
    return "failed" as const;
  }
}

type RetryRow = {
  id: string;
  type: NotificationInput["type"];
  service_slug: string | null;
  description: string;
  location_postcode: string | null;
  driveable: boolean | null;
  customers: { name: string; email: string | null; phone: string; preferred_contact: NotificationInput["contact"]["preferredContact"] } | null;
  vehicles: { registration: string | null; make: string | null; model: string | null; derivative: string | null; year: number | null; colour: string | null; fuel_type: string | null; transmission: string | null; engine_capacity_cc: number | null; body_type: string | null } | null;
};

export async function retryEnquiryNotifications(enquiryId: string) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Notification service is not configured");
  const { data, error } = await admin.from("enquiries").select("id,type,service_slug,description,location_postcode,driveable,customers(name,email,phone,preferred_contact),vehicles(registration,make,model,derivative,year,colour,fuel_type,transmission,engine_capacity_cc,body_type)").eq("id", enquiryId).single();
  if (error || !data) throw new Error("Enquiry could not be loaded");
  const row = data as unknown as RetryRow;
  if (!row.customers) throw new Error("Customer details are unavailable");
  const registration = row.vehicles?.registration;
  const input: NotificationInput = {
    type: row.type,
    contact: { name: row.customers.name, email: row.customers.email || undefined, phone: row.customers.phone, preferredContact: row.customers.preferred_contact },
    serviceSlug: row.service_slug || undefined,
    description: row.description,
    locationPostcode: row.location_postcode || undefined,
    driveable: row.driveable ?? undefined,
    vehicle: row.vehicles && registration ? {
      registration,
      make: row.vehicles.make || undefined,
      model: row.vehicles.model || undefined,
      derivative: row.vehicles.derivative || undefined,
      year: row.vehicles.year || undefined,
      colour: row.vehicles.colour || undefined,
      fuelType: row.vehicles.fuel_type || undefined,
      transmission: row.vehicles.transmission || undefined,
      engineCapacityCc: row.vehicles.engine_capacity_cc || undefined,
      bodyType: row.vehicles.body_type || undefined,
    } : undefined,
  };
  const status = await sendNotifications(enquiryId, input);
  await admin.from("enquiries").update({ notification_status: status }).eq("id", enquiryId);
  return status;
}
