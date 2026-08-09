import "server-only";

import { createAdminClient, createClient } from "@/lib/supabase/server";
export { isSoldPageExpired } from "@/lib/sales/policy";
import type { SaleVehicle } from "@/types/domain";

type VehicleRow = {
  id: string; slug: string; make: string; model: string; derivative: string | null; year: number; mileage: number; price: number; fuel_type: string; transmission: string; engine_size: string | null; colour: string | null; description: string; features: string[]; warranty: { available: boolean; description?: string } | null; finance_available: boolean; status: "available" | "reserved" | "sold"; sold_at: string | null; created_at: string;
  sale_vehicle_images?: Array<{ id: string; object_path: string; alt_text: string; position: number }>;
};

function mapVehicle(row: VehicleRow): SaleVehicle {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return {
    id: row.id, slug: row.slug, make: row.make, model: row.model, derivative: row.derivative || undefined,
    year: row.year, mileage: row.mileage, price: row.price, fuelType: row.fuel_type,
    transmission: row.transmission, engineSize: row.engine_size || undefined, colour: row.colour || undefined,
    description: row.description, features: row.features, warranty: row.warranty || undefined,
    financeAvailable: row.finance_available, status: row.status, soldAt: row.sold_at || undefined, createdAt: row.created_at,
    images: (row.sale_vehicle_images || []).sort((a, b) => a.position - b.position).map((image) => ({ id: image.id, alt: image.alt_text, position: image.position, url: `${base}/storage/v1/object/public/vehicle-sales/${image.object_path}` })),
  };
}

export async function getPublicSaleVehicles() {
  const client = await createClient();
  if (!client) return [] as SaleVehicle[];
  const { data } = await client.from("sale_vehicles").select("*, sale_vehicle_images(*)").in("status", ["available", "reserved"]).order("created_at", { ascending: false });
  return ((data || []) as VehicleRow[]).map(mapVehicle);
}

export async function getSaleVehicle(slug: string) {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("sale_vehicles").select("*, sale_vehicle_images(*)").eq("slug", slug).maybeSingle();
  return data ? mapVehicle(data as VehicleRow) : null;
}
