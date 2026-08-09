import type { ServiceDeliveryType } from "@/types/domain";

export const siteConfig = {
  name: "SOB Autofix",
  legalName: "SOB Autofix Limited",
  tagline: "Professional Diagnostics. Not Guesswork.",
  supportingLine: "Automotive Diagnosis, Repair & Sales",
  companyNumber: "16182532",
  phone: "07469273483",
  whatsapp: "07468273483",
  email: "sobautofix@gmail.com",
  address: {
    building: "Cumbrae",
    street: "Station Road",
    town: "Norton",
    city: "Doncaster",
    postcode: "DN6 9HF",
    country: "United Kingdom",
    countryCode: "GB",
  },
  openingHours: {
    monday: "24 Hours",
    tuesday: "24 Hours",
    wednesday: "24 Hours",
    thursday: "24 Hours",
    friday: "24 Hours",
    saturday: "24 Hours",
    sunday: "24 Hours",
    bankHolidays: "24 Hours",
  },
  yearsInBusiness: 4,
  accreditations: ["NABTEB", "Automotive Service Management Certificate"],
  calendlyUrl: process.env.NEXT_PUBLIC_CALENDLY_URL ?? "",
  googleMapsUrl: process.env.NEXT_PUBLIC_GOOGLE_MAPS_URL ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const formatPhone = (phone: string) =>
  phone.length === 11 ? `${phone.slice(0, 5)} ${phone.slice(5)}` : phone;

export const contactLinks = {
  phone: `tel:+44${siteConfig.phone.slice(1)}`,
  whatsapp: `https://wa.me/44${siteConfig.whatsapp.slice(1)}`,
  email: `mailto:${siteConfig.email}`,
};

export type ServiceDefinition = {
  slug: string;
  name: string;
  summary: string;
  deliveryType: ServiceDeliveryType;
  category: "diagnostics" | "repairs" | "servicing" | "other";
  published: boolean;
};

export const services: ServiceDefinition[] = [
  {
    slug: "vehicle-servicing",
    name: "Vehicle Servicing",
    summary: "Scheduled servicing and vehicle health checks tailored to your vehicle.",
    deliveryType: "in_house",
    category: "servicing",
    published: true,
  },
  {
    slug: "engine-repair",
    name: "Engine Repairs",
    summary: "Evidence-led engine fault investigation followed by approved repair work.",
    deliveryType: "in_house",
    category: "repairs",
    published: true,
  },
  {
    slug: "brake-repair",
    name: "Brake Repairs",
    summary: "Brake inspection, fault assessment and component repair or replacement.",
    deliveryType: "in_house",
    category: "repairs",
    published: true,
  },
  { slug: "cambelt-timing-chain", name: "Cambelt & Timing Chain", summary: "Inspection and repair coordination for belt and chain concerns.", deliveryType: "in_house", category: "repairs", published: false },
  { slug: "suspension-repair", name: "Suspension Repairs", summary: "Diagnosis and repair of knocks, handling issues and worn components.", deliveryType: "in_house", category: "repairs", published: false },
  { slug: "steering-repair", name: "Steering Repairs", summary: "Systematic assessment of steering faults and unwanted movement.", deliveryType: "in_house", category: "repairs", published: false },
  { slug: "exhaust-repair", name: "Exhaust Repairs", summary: "Inspection and repair for exhaust noise, leaks and component faults.", deliveryType: "in_house", category: "repairs", published: false },
  { slug: "battery-replacement", name: "Battery Replacement", summary: "Battery health testing before replacement is recommended.", deliveryType: "mobile", category: "repairs", published: false },
  { slug: "alternator-repair", name: "Alternator Repairs", summary: "Charging-system tests and approved alternator repair or replacement.", deliveryType: "in_house", category: "repairs", published: false },
  { slug: "starter-motor-repair", name: "Starter Motor Repairs", summary: "Starting-circuit assessment and starter repair or replacement.", deliveryType: "in_house", category: "repairs", published: false },
  { slug: "air-conditioning-diagnostics", name: "Air Conditioning Diagnostics", summary: "Electrical and control-system diagnosis for air-conditioning faults.", deliveryType: "in_house", category: "diagnostics", published: false },
  { slug: "clutch-replacement", name: "Clutch Replacement", summary: "Clutch replacement arranged through our specialist repair network.", deliveryType: "outsourced_specialist", category: "repairs", published: false },
];

export const diagnostics: ServiceDefinition[] = [
  { slug: "car-diagnostics", name: "Vehicle Diagnostics", summary: "Professional system scanning, testing and fault investigation.", deliveryType: "mobile", category: "diagnostics", published: true },
  { slug: "electrical-fault-finding", name: "Electrical Fault Finding", summary: "Targeted testing for wiring, sensor, power and communication faults.", deliveryType: "mobile", category: "diagnostics", published: true },
  { slug: "engine-management-light", name: "Engine Management Light", summary: "Understand the warning, test the system and identify the underlying cause.", deliveryType: "mobile", category: "diagnostics", published: true },
  { slug: "ecu-diagnostics", name: "ECU Diagnostics", summary: "System-level assessment of control unit faults and communication problems.", deliveryType: "in_house", category: "diagnostics", published: true },
  { slug: "abs-diagnostics", name: "ABS Diagnostics", summary: "Warning-light scans followed by focused electrical and mechanical checks.", deliveryType: "in_house", category: "diagnostics", published: true },
  { slug: "dpf-diagnostics", name: "DPF Diagnostics", summary: "Investigate warning lights, pressure readings and underlying running faults.", deliveryType: "in_house", category: "diagnostics", published: true },
  { slug: "battery-charging", name: "Battery & Charging Diagnostics", summary: "Battery, alternator, drain and starting-system testing.", deliveryType: "mobile", category: "diagnostics", published: true },
  { slug: "car-module-repair", name: "Car Module Diagnostics", summary: "Assessment of module communication and control-system faults.", deliveryType: "in_house", category: "diagnostics", published: false },
  { slug: "tpms", name: "TPMS Diagnostics", summary: "Warning-system checks for pressure-monitoring faults.", deliveryType: "in_house", category: "diagnostics", published: false },
];

export const areas = ["Doncaster", "Bentley", "Mexborough", "Conisbrough", "Rotherham", "Barnsley", "Goole", "Scunthorpe", "Pontefract", "Wakefield"];

export const specialOffer = {
  title: "Full Service + Comprehensive Module Diagnostic Scan",
  description: "Book a full service and receive a computerized diagnostic scan of vehicle modules.",
  active: true,
} as const;

export const mainNavigation = [
  { label: "Services", href: "/services" },
  { label: "Diagnostics", href: "/diagnostics" },
  { label: "Mobile Mechanic", href: "/mobile-mechanic" },
  { label: "Vehicle Inspections", href: "/vehicle-inspections" },
  { label: "Fleet", href: "/fleet" },
  { label: "Cars for Sale", href: "/cars-for-sale" },
  { label: "Areas", href: "/areas" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;
