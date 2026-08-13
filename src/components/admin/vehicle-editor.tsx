import type { SaleVehicle } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { AdminField } from "./content-editor";
import { VehicleFeatureSelector } from "./vehicle-feature-selector";
import { VehicleMakeModelFields } from "./vehicle-make-model-fields";
import { VehicleSalesSelect } from "./vehicle-sales-select";
import { VehicleYearSelect } from "./vehicle-year-select";

export function VehicleEditor({ vehicle, action }: { vehicle?: SaleVehicle; action: (formData: FormData) => void | Promise<void> }) {
  return <form action={action} className="grid gap-6 rounded-2xl border border-[#E4EAF0] bg-white p-6">
    {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
    <div className="grid gap-5 md:grid-cols-2">
      <AdminField label="Registration"><input name="registration" defaultValue={vehicle?.registration} pattern="[A-Za-z0-9 ]{2,9}" /></AdminField>
      <AdminField label="Slug"><input name="slug" required defaultValue={vehicle?.slug} pattern="[a-z0-9-]+" /></AdminField>
      <AdminField label="Status"><select name="status" defaultValue={vehicle?.status || "draft"}><option value="draft">Draft</option><option value="available">Live</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="archived">Archived</option></select></AdminField>
      <VehicleMakeModelFields initialMake={vehicle?.make} initialModel={vehicle?.model} />
      <AdminField label="Derivative"><input name="derivative" defaultValue={vehicle?.derivative} /></AdminField>
      <AdminField label="Year"><VehicleYearSelect value={vehicle?.year} /></AdminField>
      <AdminField label="Mileage"><input name="mileage" required type="number" min="0" defaultValue={vehicle?.mileage} /></AdminField>
      <AdminField label="Price (£)"><input name="price" required type="number" min="0" defaultValue={vehicle?.price} /></AdminField>
      <AdminField label="Fuel"><VehicleSalesSelect name="fuelType" required value={vehicle?.fuelType} /></AdminField>
      <AdminField label="Transmission"><VehicleSalesSelect name="transmission" required value={vehicle?.transmission} /></AdminField>
      <AdminField label="Engine size"><VehicleSalesSelect name="engineSize" value={vehicle?.engineSize} /></AdminField>
      <AdminField label="Colour"><VehicleSalesSelect name="colour" value={vehicle?.colour} /></AdminField>
      <AdminField label="Body type"><VehicleSalesSelect name="bodyType" value={vehicle?.bodyType} /></AdminField>
      <div className="md:col-span-2"><AdminField label="Description"><textarea name="description" required minLength={20} rows={5} defaultValue={vehicle?.description} /></AdminField></div>
      <div className="md:col-span-2"><VehicleFeatureSelector defaultValue={vehicle?.features} /></div>
    </div>
    <div className="grid gap-4 rounded-xl bg-[#F4F7FA] p-5 sm:grid-cols-2">
      <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" name="financeAvailable" defaultChecked={vehicle?.financeAvailable} /> Finance may be available</label>
      <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" name="warrantyAvailable" defaultChecked={vehicle?.warranty?.available} /> Warranty available</label>
      <div className="sm:col-span-2"><AdminField label="Vehicle-specific warranty wording"><textarea name="warrantyDescription" rows={3} defaultValue={vehicle?.warranty?.description} /></AdminField></div>
    </div>
    <div className="flex justify-end"><Button type="submit">Save vehicle</Button></div>
  </form>;
}
