// Pure mapping from validated API requests to the jsonb payloads expected by
// create_vehicle_enquiry() and create_seller_submission()
// (supabase/migrations/20261028090100_auto_exchange.sql), plus RPC error
// mapping. Kept free of I/O so it can be unit tested.

import { isMissingSchemaError } from "@/lib/exchange/schema";
import type { SaleVehicle } from "@/types/domain";
import { formatDateTime, formatMileage, vehicleName } from "./format";
import type { SellerSubmissionRequest, VehicleEnquiryRequest } from "./schemas";

export type EnquiryVehicleRef = Pick<SaleVehicle, "id" | "year" | "make" | "model" | "derivative" | "stockReference">;

export function buildVehicleEnquiryPayload(input: VehicleEnquiryRequest, vehicle: EnquiryVehicleRef, times: { start?: Date; alternative?: Date }, durationMinutes: number) {
  const name = `${vehicleName(vehicle)}${vehicle.derivative ? ` ${vehicle.derivative}` : ""}`;
  const reference = vehicle.stockReference ? ` (stock ${vehicle.stockReference})` : "";
  const description = input.intent === "viewing"
    ? [
        `Viewing request for the ${name}${reference}.`,
        times.start ? `Requested time: ${formatDateTime(times.start)} (awaiting staff confirmation).` : "",
        times.alternative ? `Alternative time: ${formatDateTime(times.alternative)}.` : "",
        input.message ? `\nMessage from the customer:\n${input.message}` : "",
      ].filter(Boolean).join("\n")
    : `Question about the ${name}${reference}:\n\n${input.message || ""}`;
  return {
    idempotencyKey: input.idempotencyKey,
    intent: input.intent,
    vehicleId: vehicle.id,
    name: input.name,
    email: input.email || "",
    phone: input.phone,
    preferredContact: input.preferredContact,
    description: description.slice(0, 5000),
    message: input.message || "",
    ...(input.intent === "viewing" && times.start ? { preferredStart: times.start.toISOString(), durationMinutes } : {}),
    ...(input.intent === "viewing" && times.alternative ? { alternativeStart: times.alternative.toISOString() } : {}),
  };
}

const runningLabels: Record<string, string> = { runs_and_drives: "Runs and drives", runs_not_driveable: "Runs but is not driveable", does_not_run: "Does not run", not_sure: "Not sure" };
const answerLabels: Record<string, string> = { yes: "Yes", no: "No", not_sure: "Not sure", valid: "Valid", expired: "Expired", full: "Full", partial: "Partial", none: "None" };

export function sellerVehicleSummary(vehicle: SellerSubmissionRequest["vehicle"]) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.derivative].filter(Boolean).join(" ");
}

export function runningStatusLabel(value: string) {
  return runningLabels[value] || value;
}

export function answerLabel(value: string) {
  return answerLabels[value] || value;
}

/**
 * The enquiry thread description deliberately leaves out the registration
 * and the free-text faults and damage: those live only on the seller
 * submission, where the retention job removes them (DECISIONS.md D11).
 */
export function buildSellerSubmissionPayload(input: SellerSubmissionRequest, interestedVehicle: EnquiryVehicleRef | null) {
  const kind = interestedVehicle ? "part_exchange" : "sell";
  const summary = sellerVehicleSummary(input.vehicle);
  const description = [
    `${kind === "part_exchange" ? "Part exchange" : "Sell your car"} enquiry: ${summary}, ${formatMileage(input.vehicle.mileage)}.`,
    interestedVehicle ? `Interested in the ${vehicleName(interestedVehicle)}${interestedVehicle.stockReference ? ` (stock ${interestedVehicle.stockReference})` : ""}.` : "",
    `Running: ${runningStatusLabel(input.condition.runningStatus)}. Service history: ${answerLabel(input.condition.serviceHistory)}. Outstanding finance: ${answerLabel(input.condition.outstandingFinance)}.`,
    `Photos selected: ${input.photoCount}.`,
    "Condition notes, registration and photos are on the seller submission.",
  ].filter(Boolean).join("\n");
  return {
    idempotencyKey: input.idempotencyKey,
    kind,
    interestedVehicleId: interestedVehicle?.id || "",
    name: input.contact.name,
    email: input.contact.email || "",
    phone: input.contact.phone,
    preferredContact: input.contact.preferredContact,
    postcode: input.contact.postcode,
    marketingConsent: input.contact.marketingConsent,
    registration: input.vehicle.registration,
    lookupSource: input.vehicle.lookupSource,
    make: input.vehicle.make,
    model: input.vehicle.model,
    derivative: input.vehicle.derivative || "",
    year: input.vehicle.year,
    mileage: input.vehicle.mileage,
    fuelType: input.vehicle.fuelType || "",
    transmission: input.vehicle.transmission || "",
    colour: input.vehicle.colour || "",
    runningStatus: input.condition.runningStatus,
    knownFaults: input.condition.knownFaults || "",
    damage: input.condition.damage || "",
    motStatus: input.condition.motStatus,
    motExpiry: input.condition.motStatus === "valid" ? input.condition.motExpiry || "" : "",
    serviceHistory: input.condition.serviceHistory,
    outstandingFinance: input.condition.outstandingFinance,
    description,
  };
}

export type RpcFailure = "SCHEMA_MISSING" | "VEHICLE_UNAVAILABLE" | "FAILED";

/** Map a Postgres/PostgREST error from the exchange RPCs to a public outcome. */
export function mapRpcError(error: { code?: string; message?: string } | null | undefined): RpcFailure {
  if (!error) return "FAILED";
  if (isMissingSchemaError(error)) return "SCHEMA_MISSING";
  if (error.message?.includes("VEHICLE_UNAVAILABLE")) return "VEHICLE_UNAVAILABLE";
  return "FAILED";
}
