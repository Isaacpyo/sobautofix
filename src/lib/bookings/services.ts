import "server-only";

import { getSchedulingProvider } from "@/lib/calcom/client";
import type { BookingServiceOption } from "./types";
import { createAdminClient } from "@/lib/supabase/server";

export type BookingServiceMapping = {
  id: string;
  key: string;
  name: string;
  description: string;
  provider: string;
  providerEventTypeId: number;
  locationMode: "workshop" | "mobile" | "both";
};

type BookingServiceRow = {
  id: string;
  service_key: string;
  display_name: string;
  description: string;
  provider: string;
  provider_event_type_id: number | null;
  location_mode: "workshop" | "mobile" | "both";
};

export function bookingTimezone() {
  const configured = process.env.CALCOM_DEFAULT_TIMEZONE?.trim() || "Europe/London";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: configured }).format(new Date());
    return configured;
  } catch {
    return "Europe/London";
  }
}

function mapService(row: BookingServiceRow): BookingServiceMapping | null {
  if (!Number.isSafeInteger(row.provider_event_type_id) || !row.provider_event_type_id || row.provider !== "calcom") return null;
  return {
    id: row.id,
    key: row.service_key,
    name: row.display_name,
    description: row.description,
    provider: row.provider,
    providerEventTypeId: row.provider_event_type_id,
    locationMode: row.location_mode,
  };
}

export async function listPublicBookingServices(): Promise<BookingServiceOption[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("booking_service_types")
    .select("id,service_key,display_name,description,provider,provider_event_type_id,location_mode")
    .eq("online_booking_enabled", true)
    .eq("provider", "calcom")
    .not("provider_event_type_id", "is", null)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as BookingServiceRow[]).flatMap((row) => {
    const mapped = mapService(row);
    return mapped ? [{ key: mapped.key, name: mapped.name, description: mapped.description, locationMode: mapped.locationMode }] : [];
  });
}

export async function getBookableService(serviceKey: string, locationMode: "workshop" | "mobile") {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("booking_service_types")
    .select("id,service_key,display_name,description,provider,provider_event_type_id,location_mode")
    .eq("service_key", serviceKey)
    .eq("online_booking_enabled", true)
    .maybeSingle();
  if (error || !data) return null;
  const service = mapService(data as BookingServiceRow);
  if (!service || (service.locationMode !== "both" && service.locationMode !== locationMode)) return null;
  return service;
}

export async function getAvailableSlotsForService(input: {
  serviceKey: string;
  locationMode: "workshop" | "mobile";
  start: string;
  end: string;
}) {
  const service = await getBookableService(input.serviceKey, input.locationMode);
  if (!service) return null;
  const slots = await getSchedulingProvider().getAvailableSlots({
    eventTypeId: service.providerEventTypeId,
    start: input.start,
    end: input.end,
    timeZone: bookingTimezone(),
  });
  return { service, slots, timeZone: bookingTimezone() };
}

export async function getAvailableRescheduleSlots(input: {
  providerEventTypeId: number;
  providerBookingUid: string;
  start: string;
  end: string;
}) {
  return getSchedulingProvider().getAvailableSlots({
    eventTypeId: input.providerEventTypeId,
    start: input.start,
    end: input.end,
    timeZone: bookingTimezone(),
    bookingUidToReschedule: input.providerBookingUid,
  });
}

export async function getBookingServiceReadiness() {
  const admin = createAdminClient();
  if (!admin) return { configured: false, mappedServices: 0 };
  const { count, error } = await admin
    .from("booking_service_types")
    .select("id", { count: "exact", head: true })
    .eq("online_booking_enabled", true)
    .eq("provider", "calcom")
    .not("provider_event_type_id", "is", null);
  return { configured: !error && Boolean(process.env.CALCOM_API_KEY) && (count || 0) > 0, mappedServices: error ? 0 : count || 0 };
}
