import { diagnostics, services } from "@/config/site";

const bookingServices = [
  "Vehicle Diagnostics",
  "Electrical Fault Finding",
  "Vehicle Servicing",
  "Engine Repair Assessment",
  "Brake Repair Assessment",
  "Mobile Diagnostic Visit",
  "Pre-Purchase Inspection",
];

export const invoiceServiceOptions = [...new Map(
  [...bookingServices, ...services.filter((service) => service.published).map((service) => service.name), ...diagnostics.filter((service) => service.published).map((service) => service.name)]
    .map((name) => [name.toLocaleLowerCase("en-GB"), name]),
).values()].sort((left, right) => left.localeCompare(right, "en-GB"));
