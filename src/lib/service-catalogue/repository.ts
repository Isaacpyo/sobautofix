import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

export type CatalogueService = {
  id: string;
  key: string;
  name: string;
  description: string;
  locationMode: "workshop" | "mobile" | "both";
  providerEventTypeId: number | null;
  onlineBookingEnabled: boolean;
  sortOrder: number;
};

export type CatalogueSystem = {
  id: string;
  key: string;
  name: string;
  description: string;
  sortOrder: number;
  services: CatalogueService[];
};

type CatalogueRow = {
  id: string;
  system_id: string;
  service_key: string;
  display_name: string;
  description: string;
  location_mode: "workshop" | "mobile" | "both";
  provider_event_type_id: number | null;
  online_booking_enabled: boolean;
  sort_order: number;
};

type SystemRow = { id: string; system_key: string; display_name: string; description: string; sort_order: number };

export async function listServiceCatalogue(options: { bookableOnly?: boolean } = {}): Promise<CatalogueSystem[]> {
  const client = createAdminClient();
  if (!client) return [];

  const systemsQuery = client
    .from("service_catalogue_systems")
    .select("id,system_key,display_name,description,sort_order")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  let serviceData: unknown[] | null = null;
  let serviceFailed = false;
  if (options.bookableOnly) {
    const result = await client
      .from("booking_service_types")
      .select("id,system_id,service_key,display_name,description,location_mode,provider_event_type_id,online_booking_enabled,sort_order")
      .is("deleted_at", null)
      .not("system_id", "is", null)
      .eq("online_booking_enabled", true)
      .eq("provider", "calcom")
      .not("provider_event_type_id", "is", null)
      .order("sort_order", { ascending: true });
    serviceData = result.data;
    serviceFailed = Boolean(result.error);
  } else {
    const result = await client
      .from("booking_service_types")
      .select("id,system_id,service_key,display_name,description,location_mode,provider_event_type_id,online_booking_enabled,sort_order")
      .is("deleted_at", null)
      .not("system_id", "is", null)
      .order("sort_order", { ascending: true });
    serviceData = result.data;
    serviceFailed = Boolean(result.error);
  }

  const { data: systemData, error: systemError } = await systemsQuery;
  if (systemError || serviceFailed || !systemData || !serviceData) return [];

  const systems = new Map<string, CatalogueSystem>((systemData as SystemRow[]).map((row) => [row.id, {
    id: row.id,
    key: row.system_key,
    name: row.display_name,
    description: row.description,
    sortOrder: row.sort_order,
    services: [],
  }]));
  for (const row of serviceData as unknown as CatalogueRow[]) {
    const system = systems.get(row.system_id);
    if (!system) continue;
    system.services.push({
      id: row.id,
      key: row.service_key,
      name: row.display_name,
      description: row.description,
      locationMode: row.location_mode,
      providerEventTypeId: row.provider_event_type_id,
      onlineBookingEnabled: row.online_booking_enabled,
      sortOrder: row.sort_order,
    });
  }

  return [...systems.values()]
    .filter((system) => !options.bookableOnly || system.services.length > 0)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "en-GB"))
    .map((system) => ({ ...system, services: system.services.toSorted((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "en-GB")) }));
}
