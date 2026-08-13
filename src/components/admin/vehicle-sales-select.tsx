import { vehicleSalesOptions, type VehicleSalesOptionName } from "@/lib/vehicle/sales-options";

export function VehicleSalesSelect({ name, value, required = false }: { name: VehicleSalesOptionName; value?: string; required?: boolean }) {
  const options: readonly string[] = vehicleSalesOptions[name];
  const current = value?.trim() || "";
  const includesCurrent = Boolean(current) && options.some((option) => option.toLocaleLowerCase("en-GB") === current.toLocaleLowerCase("en-GB"));
  return <select name={name} required={required} defaultValue={current}>
    <option value="">Select an option</option>
    {current && !includesCurrent && <option value={current}>{current} (current)</option>}
    {options.map((option) => <option key={option} value={option}>{option}</option>)}
  </select>;
}
