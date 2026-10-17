import { ConfirmSubmitButton } from "./confirm-submit-button";

export function VehicleSoldToggle({ vehicleId, vehicleName, sold, action, className = "" }: { vehicleId: string; vehicleName: string; sold: boolean; action: (formData: FormData) => void | Promise<void>; className?: string }) {
  return <form action={action} className={className}>
    <input type="hidden" name="id" value={vehicleId} />
    <input type="hidden" name="sold" value={sold ? "false" : "true"} />
    {sold
      ? <ConfirmSubmitButton message={`Put the ${vehicleName} back on sale? The sold banner will be removed and the car will show as available.`} className="inline-flex min-h-10 items-center rounded-lg border border-[#BCD6F6] px-3 text-xs font-extrabold text-[#1446A5] hover:bg-[#F1F7FF]">Relist</ConfirmSubmitButton>
      : <ConfirmSubmitButton message={`Mark the ${vehicleName} as sold? A sold banner will show on the public listing for 90 days.`} className="inline-flex min-h-10 items-center rounded-lg bg-[#B42318] px-3 text-xs font-extrabold text-white hover:bg-[#912018]">Mark as sold</ConfirmSubmitButton>}
  </form>;
}
