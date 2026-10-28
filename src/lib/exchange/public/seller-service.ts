import "server-only";

import { renderSellerSubmissionReceived, renderSellerSubmissionStaffNotification } from "@/lib/email/templates/exchange";
import { createInitialEnquiryMessage } from "@/lib/enquiries/thread-repository";
import { exchangeCanonical } from "@/lib/exchange/links";
import { getExchangeSettings } from "@/lib/exchange/settings";
import { createAdminClient } from "@/lib/supabase/server";
import { ExchangeServiceError } from "./enquiry-service";
import { formatMileage, vehicleName } from "./format";
import { sendExchangeNotifications } from "./notifications";
import { answerLabel, buildSellerSubmissionPayload, mapRpcError, runningStatusLabel, sellerVehicleSummary } from "./payloads";
import type { SellerSubmissionRequest } from "./schemas";
import { getListedVehicleById } from "./stock";

/**
 * Save a sell-your-car or part-exchange enquiry through
 * create_seller_submission() (atomic, idempotent), add its email thread
 * message and send notifications. Photos are uploaded afterwards with the
 * upload token returned to the browser.
 */
export async function submitSellerSubmission(input: SellerSubmissionRequest) {
  const listed = input.interestedVehicleId ? await getListedVehicleById(input.interestedVehicleId) : null;
  const interested = listed && ["available", "reserved"].includes(listed.status) ? listed : null;

  const admin = createAdminClient();
  if (!admin) throw new ExchangeServiceError("NOT_CONFIGURED", "Enquiries are temporarily unavailable.");
  const payload = buildSellerSubmissionPayload(input, interested);
  const { data, error } = await admin.rpc("create_seller_submission", { p_payload: payload });
  if (error) {
    const failure = mapRpcError(error);
    throw new ExchangeServiceError(failure === "VEHICLE_UNAVAILABLE" ? "FAILED" : failure, "We could not save your enquiry.");
  }
  const row = (Array.isArray(data) ? data[0] : data) as { submission_id: string; reference: string; enquiry_id: string; created: boolean } | undefined;
  if (!row?.submission_id) throw new ExchangeServiceError("FAILED", "We could not save your enquiry.");

  let notificationStatus: "sent" | "failed" | "skipped" = "skipped";
  if (row.created && row.enquiry_id) {
    try {
      await createInitialEnquiryMessage(row.enquiry_id, { type: "vehicle_purchase", customerName: input.contact.name, customerEmail: input.contact.email, description: payload.description });
    } catch {
      // The submission is saved; staff still see it in Buying Enquiries.
    }
    const settings = await getExchangeSettings();
    const emailInput = {
      exchangeName: settings.name,
      exchangeUrl: exchangeCanonical("/"),
      submissionId: row.submission_id,
      reference: row.reference,
      kind: payload.kind as "sell" | "part_exchange",
      customerName: input.contact.name,
      customerEmail: input.contact.email,
      phone: input.contact.phone,
      preferredContact: input.contact.preferredContact,
      postcode: input.contact.postcode,
      vehicleSummary: sellerVehicleSummary(input.vehicle),
      registration: input.vehicle.registration,
      mileage: formatMileage(input.vehicle.mileage),
      runningStatus: runningStatusLabel(input.condition.runningStatus),
      outstandingFinance: answerLabel(input.condition.outstandingFinance),
      interestedVehicle: interested ? vehicleName(interested) : undefined,
      photoCount: input.photoCount,
      responsePromise: settings.sellerResponsePromise || undefined,
    };
    notificationStatus = await sendExchangeNotifications({
      enquiryId: row.enquiry_id,
      enquiryType: "vehicle_purchase",
      customerEmail: input.contact.email,
      staff: { subject: `${payload.kind === "part_exchange" ? "Part exchange" : "Sell your car"} enquiry ${row.reference}: ${emailInput.vehicleSummary}`, email: renderSellerSubmissionStaffNotification(emailInput) },
      customer: input.contact.email ? { to: input.contact.email, subject: `We received your enquiry (${row.reference})`, email: renderSellerSubmissionReceived(emailInput) } : undefined,
    }).catch(() => "failed" as const);
  }

  return { submissionId: row.submission_id, reference: row.reference, created: row.created, kind: payload.kind, notificationStatus };
}
