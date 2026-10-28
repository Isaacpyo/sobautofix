import "server-only";

import { exchangeCanonical } from "@/lib/exchange/links";
import { getExchangePrivateSettings, getExchangeSettings } from "@/lib/exchange/settings";
import { renderVehicleEnquiryReceived, renderVehicleEnquiryStaffNotification } from "@/lib/email/templates/exchange";
import { createInitialEnquiryMessage } from "@/lib/enquiries/thread-repository";
import { createAdminClient } from "@/lib/supabase/server";
import type { SaleVehicle } from "@/types/domain";
import { formatDateTime, formatPrice, vehicleName } from "./format";
import { buildVehicleEnquiryPayload, mapRpcError } from "./payloads";
import type { VehicleEnquiryRequest } from "./schemas";
import { getListedVehicleById, getSimilarVehicles } from "./stock";
import { resolveViewingTime } from "./viewing-time";

export type ServiceFailureCode = "SCHEMA_MISSING" | "VEHICLE_UNAVAILABLE" | "NOT_CONFIGURED" | "FAILED" | "INVALID";

export class ExchangeServiceError extends Error {
  constructor(readonly code: ServiceFailureCode, message: string, readonly fields?: Record<string, string[]>, readonly similar?: SaleVehicle[], readonly currentStatus?: string) {
    super(message);
    this.name = "ExchangeServiceError";
  }
}

export function vehicleUnavailableMessage(status?: string) {
  if (status === "reserved") return "This car has just been reserved for another buyer, so we cannot take a viewing request for it. You can still send us a question, or look at similar cars.";
  if (status === "sold") return "Sorry, this car has just been sold. Have a look at similar cars instead.";
  return "Sorry, this car is no longer available. Have a look at similar cars instead.";
}

/**
 * Save a viewing request or a question through create_vehicle_enquiry()
 * (atomic, idempotent on idempotencyKey, rechecks availability), add the
 * email thread message, then notify staff and the customer. The enquiry is
 * never lost because a later step fails.
 */
export async function submitVehicleEnquiry(input: VehicleEnquiryRequest, now = new Date()) {
  const vehicle = await getListedVehicleById(input.vehicleId);
  const unavailable = async (target: SaleVehicle | null, status: string | undefined = target?.status) => new ExchangeServiceError("VEHICLE_UNAVAILABLE", vehicleUnavailableMessage(status), undefined, target ? await getSimilarVehicles(target, 3) : [], status || "unavailable");
  if (!vehicle) throw await unavailable(null);
  if (input.intent === "viewing" && vehicle.status !== "available") throw await unavailable(vehicle);
  if (input.intent === "question" && !["available", "reserved"].includes(vehicle.status)) throw await unavailable(vehicle);

  let start: Date | undefined;
  let alternative: Date | undefined;
  if (input.intent === "viewing") {
    const preferred = resolveViewingTime(input.preferredDate || "", input.preferredTime || "", now);
    if (!preferred.ok) throw new ExchangeServiceError("INVALID", "Check the viewing time and try again.", { preferredDate: [preferred.reason] });
    start = preferred.start;
    if (input.alternativeDate && input.alternativeTime) {
      const second = resolveViewingTime(input.alternativeDate, input.alternativeTime, now);
      if (!second.ok) throw new ExchangeServiceError("INVALID", "Check the alternative time and try again.", { alternativeDate: [second.reason] });
      alternative = second.start;
    }
  }

  const admin = createAdminClient();
  if (!admin) throw new ExchangeServiceError("NOT_CONFIGURED", "Enquiries are temporarily unavailable.");
  const [privateSettings, settings] = await Promise.all([getExchangePrivateSettings(), getExchangeSettings()]);
  const payload = buildVehicleEnquiryPayload(input, vehicle, { start, alternative }, privateSettings.viewingLengthMinutes);
  const { data, error } = await admin.rpc("create_vehicle_enquiry", { p_payload: payload });
  if (error) {
    const failure = mapRpcError(error);
    if (failure === "VEHICLE_UNAVAILABLE") throw await unavailable(vehicle, (await getListedVehicleById(vehicle.id))?.status || "unavailable");
    throw new ExchangeServiceError(failure, failure === "SCHEMA_MISSING" ? "Enquiries are temporarily unavailable." : "We could not save your request.");
  }
  const row = (Array.isArray(data) ? data[0] : data) as { enquiry_id: string; appointment_id: string | null; created: boolean } | undefined;
  if (!row?.enquiry_id) throw new ExchangeServiceError("FAILED", "We could not save your request.");

  let notificationStatus: "sent" | "failed" | "skipped" = "skipped";
  // A repeated submission (same idempotency key) returns the saved enquiry without notifying twice.
  if (row.created) {
    try {
      await createInitialEnquiryMessage(row.enquiry_id, { type: "vehicle_sales", customerName: input.name, customerEmail: input.email, description: payload.description });
    } catch {
      // The enquiry is saved; staff still see it in the admin without the thread message.
    }
    const name = `${vehicleName(vehicle)}${vehicle.derivative ? ` ${vehicle.derivative}` : ""}`;
    const emailInput = {
      exchangeName: settings.name,
      exchangeUrl: exchangeCanonical("/"),
      enquiryId: row.enquiry_id,
      intent: input.intent,
      customerName: input.name,
      customerEmail: input.email,
      phone: input.phone,
      preferredContact: input.preferredContact,
      vehicleName: name,
      vehiclePrice: formatPrice(vehicle.price),
      vehicleUrl: exchangeCanonical(`/cars/${vehicle.slug}`),
      stockReference: vehicle.stockReference,
      requestedTime: start ? formatDateTime(start) : undefined,
      alternativeTime: alternative ? formatDateTime(alternative) : undefined,
      message: input.message,
    };
    const { sendExchangeNotifications } = await import("./notifications");
    notificationStatus = await sendExchangeNotifications({
      enquiryId: row.enquiry_id,
      enquiryType: "vehicle_sales",
      customerEmail: input.email,
      staff: { subject: `${input.intent === "viewing" ? "Viewing request" : "Question"}: ${vehicleName(vehicle)}`, email: renderVehicleEnquiryStaffNotification(emailInput) },
      customer: input.email ? { to: input.email, subject: input.intent === "viewing" ? `Viewing request received: ${vehicleName(vehicle)}` : `We received your question about the ${vehicleName(vehicle)}`, email: renderVehicleEnquiryReceived(emailInput) } : undefined,
    }).catch(() => "failed" as const);
  }

  return { enquiryId: row.enquiry_id, created: row.created, requestedStart: start?.toISOString(), alternativeStart: alternative?.toISOString(), notificationStatus };
}
