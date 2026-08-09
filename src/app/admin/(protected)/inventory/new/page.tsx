import { VehicleEditor } from "@/components/admin/vehicle-editor";
import { saveSaleVehicle } from "../../actions";

export default function NewVehiclePage() { return <><p className="text-xs font-extrabold tracking-widest text-[#1974E2] uppercase">Vehicle sales</p><h1 className="mb-8 mt-2 text-4xl font-extrabold text-[#071127]">Add vehicle</h1><VehicleEditor action={saveSaleVehicle} /></>; }
