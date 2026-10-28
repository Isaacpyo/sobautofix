import { reserveVehicleAction } from "@/app/admin/(protected)/exchange/sales/actions";
import { ActionForm, ConfirmButton, MoneyField, SelectField, TextField } from "./forms";
import { formatPounds } from "./labels";

/** Records a reservation (vehicle_sales). The vehicle then shows as Reserved on the website. */
export function ReserveForm({ vehicle, enquiryId, canChangePrice, partExchangeOptions = [] }: { vehicle: { id: string; title: string; price: number }; enquiryId?: string; canChangePrice: boolean; partExchangeOptions?: Array<{ id: string; reference: string; title: string }> }) {
  return <ActionForm action={reserveVehicleAction} hidden={{ vehicleId: vehicle.id, enquiryId }} aria-label={`Reserve ${vehicle.title}`}>
    <div className="grid gap-3 sm:grid-cols-2">
      <MoneyField name="agreedPrice" label="Agreed price" defaultValue={String(vehicle.price)} required readOnly={!canChangePrice} hint={canChangePrice ? `Advertised at ${formatPounds(vehicle.price)}.` : `Advertised price. Only an owner or manager can agree a different price.`} />
      <MoneyField name="deposit" label="Deposit received" hint="Recorded only. No online payments are taken." />
      <TextField name="paymentMethod" label="Deposit paid by" placeholder="For example bank transfer" />
      <TextField name="reservationExpiresAt" label="Reservation ends" type="datetime-local" hint="UK time. Shown in Overview when it is close." />
      {partExchangeOptions.length > 0 && <SelectField name="partExchangeSubmissionId" label="Part exchange" placeholder="No part exchange" options={partExchangeOptions.map((option) => ({ value: option.id, label: `${option.reference} · ${option.title}` }))} />}
      {partExchangeOptions.length > 0 && <MoneyField name="partExchangeAllowance" label="Part-exchange allowance" />}
    </div>
    <div className="mt-4 flex justify-end"><ConfirmButton variant="primary" tone="warning" title="Reserve this vehicle?" message={`The ${vehicle.title} will show as Reserved on the website and cannot be reserved by anyone else until this reservation is completed or cancelled.`} confirmLabel="Reserve vehicle">Reserve this vehicle</ConfirmButton></div>
  </ActionForm>;
}
