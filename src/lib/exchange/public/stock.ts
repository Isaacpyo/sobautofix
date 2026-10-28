import "server-only";

import { cache } from "react";
import { isPublicDeliveryListing, isSoldPageExpired, isVisibleOnSalesPage } from "@/lib/sales/policy";
import { mapVehicle, type SaleVehicleRow } from "@/lib/sales/repository";
import { createPublicClient } from "@/lib/supabase/server";
import type { SaleVehicle } from "@/types/domain";

// Public stock for SOB Auto Exchange. Reads only through the public (RLS)
// client, so drafts, preparation stock, withdrawn cars and anything sold
// more than 90 days ago never reach these pages.

export type StockResult = { vehicles: SaleVehicle[]; unavailable: boolean };

const selectColumns = "*, sale_vehicle_images(id,object_path,alt_text,position)";

async function queryStock(statuses: SaleVehicle["status"][]): Promise<StockResult> {
  const client = createPublicClient();
  if (!client) return { vehicles: [], unavailable: true };
  const { data, error } = await client
    .from("sale_vehicles")
    .select(selectColumns)
    .in("status", statuses)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    // Missing schema or a database outage: a calm "temporarily unavailable" state, never a raw error.
    return { vehicles: [], unavailable: true };
  }
  const vehicles = ((data || []) as SaleVehicleRow[]).map(mapVehicle).filter((vehicle) => isPublicDeliveryListing(vehicle) && isVisibleOnSalesPage(vehicle));
  return { vehicles, unavailable: false };
}

/** Available and reserved cars, the catalogue's default view. */
export const getListedStock = cache(async () => queryStock(["available", "reserved"]));

/** Recently sold cars (90-day rule from isVisibleOnSalesPage), newest sale first. */
export const getRecentlySoldStock = cache(async (): Promise<StockResult> => {
  const result = await queryStock(["sold"]);
  const vehicles = result.vehicles
    .filter((vehicle) => vehicle.status === "sold" && !isSoldPageExpired(vehicle))
    .sort((a, b) => new Date(b.soldAt || b.updatedAt).getTime() - new Date(a.soldAt || a.updatedAt).getTime());
  return { ...result, vehicles };
});

/** Latest available cars for the home page; never sold or reserved. */
export async function getLatestAvailable(limit = 6) {
  const { vehicles, unavailable } = await getListedStock();
  const available = vehicles
    .filter((vehicle) => vehicle.status === "available")
    .sort((a, b) => new Date(b.listedAt || b.createdAt).getTime() - new Date(a.listedAt || a.createdAt).getTime())
    .slice(0, limit);
  return { vehicles: available, unavailable };
}

export type VehicleLookup = { vehicle: SaleVehicle | null; unavailable: boolean };

export const getExchangeVehicle = cache(async (slug: string): Promise<VehicleLookup> => {
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) return { vehicle: null, unavailable: false };
  const client = createPublicClient();
  if (!client) return { vehicle: null, unavailable: true };
  const { data, error } = await client.from("sale_vehicles").select(selectColumns).eq("slug", slug).is("deleted_at", null).maybeSingle();
  if (error) return { vehicle: null, unavailable: true };
  if (!data) return { vehicle: null, unavailable: false };
  const vehicle = mapVehicle(data as SaleVehicleRow);
  if (!isPublicDeliveryListing(vehicle)) return { vehicle: null, unavailable: false };
  if (!["available", "reserved", "sold"].includes(vehicle.status)) return { vehicle: null, unavailable: false };
  return { vehicle, unavailable: false };
});

/** Look up a listed vehicle by id for the enquiry APIs (public RLS, so only listed stock). */
export async function getListedVehicleById(id: string) {
  const client = createPublicClient();
  if (!client) return null;
  const { data, error } = await client.from("sale_vehicles").select(selectColumns).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error || !data) return null;
  const vehicle = mapVehicle(data as SaleVehicleRow);
  return isPublicDeliveryListing(vehicle) ? vehicle : null;
}

/**
 * Similar available cars: same make first, then closest in price. Used on
 * sold pages and when a car becomes unavailable mid-enquiry.
 */
export async function getSimilarVehicles(target: Pick<SaleVehicle, "id" | "make" | "price" | "bodyType">, limit = 3) {
  const { vehicles } = await getListedStock();
  return vehicles
    .filter((vehicle) => vehicle.id !== target.id && vehicle.status === "available")
    .map((vehicle) => ({
      vehicle,
      score: (vehicle.make === target.make ? 0 : 1) * 100_000 + (target.bodyType && vehicle.bodyType === target.bodyType ? 0 : 20_000) + Math.abs(vehicle.price - target.price),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ vehicle }) => vehicle);
}
