import { AddVehicleFlow } from "@/components/admin/add-vehicle-flow";
import { createAdminClient } from "@/lib/supabase/server";
import { saveNewSaleVehicle } from "../../actions";

export default async function NewVehiclePage() { const client = createAdminClient(); const { error } = client ? await client.from("sale_vehicles").select("registration,body_type").limit(1) : { error: new Error("Unavailable") }; return <><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Vehicle stock</p><h1 className="mb-8 mt-2 text-4xl font-extrabold text-[#071127]">Add vehicle</h1><AddVehicleFlow action={saveNewSaleVehicle} inventoryReady={!error} /></>; }
