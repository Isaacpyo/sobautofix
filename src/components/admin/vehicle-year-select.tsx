const FIRST_INVENTORY_YEAR = 2008;

export function getVehicleYearOptions(currentYear = new Date().getFullYear(), selectedYear?: number) {
  const years = Array.from({ length: Math.max(0, currentYear - FIRST_INVENTORY_YEAR + 1) }, (_, index) => currentYear - index);
  if (selectedYear && !years.includes(selectedYear)) years.push(selectedYear);
  return years.sort((left, right) => right - left);
}

export function VehicleYearSelect({ value, required = true }: { value?: number; required?: boolean }) {
  return <select name="year" required={required} defaultValue={value || ""}>
    <option value="" disabled>Select year</option>
    {getVehicleYearOptions(undefined, value).map((year) => <option key={year} value={year}>{year}</option>)}
  </select>;
}
