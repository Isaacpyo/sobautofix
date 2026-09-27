export type ServiceCatalogueCategory = {
  id: string;
  name: string;
  description: string;
  services: readonly string[];
};

export const serviceCatalogue = [
  {
    id: "diagnostics-electrical",
    name: "Diagnostics & Electrical",
    description: "Systematic testing for warning lights, wiring, networks, modules and vehicle electrical faults.",
    services: [
      "Vehicle Diagnostic Assessment", "Warning Light Diagnosis", "Check Engine Light Diagnosis", "Electrical System Diagnosis", "Electrical Fault Finding", "Wiring & Circuit Diagnosis", "Battery & Charging System Diagnosis", "Starting System Diagnosis", "No-Crank Diagnosis", "No-Start Diagnosis", "Parasitic Battery Drain Diagnosis", "Fuse & Relay Diagnosis", "CAN Bus / Vehicle Network Diagnosis", "LIN Bus Diagnosis", "Module Communication Diagnosis", "Sensor Circuit Diagnosis", "Actuator Circuit Diagnosis", "Immobiliser / Start Authorisation Diagnosis", "Lighting System Diagnosis & Repair", "Central Locking System Diagnosis & Repair", "Electric Window System Diagnosis & Repair", "Wiper / Washer System Diagnosis & Repair", "Horn System Diagnosis & Repair", "Parking Sensor System Diagnosis & Repair", "Reversing Camera System Diagnosis & Repair", "Infotainment / Radio System Diagnosis", "Accessory Electrical Installation",
    ],
  },
  {
    id: "engine-management",
    name: "Engine & Engine Management",
    description: "Fault-led assessment of engine management, performance, fuel, air, ignition and mechanical concerns.",
    services: [
      "Engine Management System Diagnosis", "Engine Performance Diagnosis", "Engine Running Fault Diagnosis", "Misfire Diagnosis", "Rough Running Diagnosis", "Engine Stalling Diagnosis", "Loss of Power Diagnosis", "Fuel System Diagnosis", "Low-Pressure Fuel System Diagnosis", "High-Pressure Fuel System Diagnosis", "Fuel Injector Diagnosis", "Air Intake System Diagnosis", "MAF / MAP Sensor Diagnosis", "Throttle System Diagnosis", "Turbocharger / Boost System Diagnosis", "Vacuum System Diagnosis", "PCV / Crankcase Ventilation Diagnosis", "Ignition System Diagnosis", "Compression / Mechanical Engine Assessment", "Timing System Assessment", "Engine Oil Leak Diagnosis", "Engine Repair",
    ],
  },
  {
    id: "cooling-heating",
    name: "Cooling & Heating",
    description: "Diagnosis and repair support for coolant loss, overheating, cabin heat and cooling-system components.",
    services: [
      "Cooling System Diagnosis", "Cooling System Pressure Test", "Coolant Leak Diagnosis", "Overheating Diagnosis", "Radiator Diagnosis & Repair", "Thermostat Diagnosis & Replacement", "Cooling Fan System Diagnosis", "Water Pump Diagnosis & Replacement", "Coolant Temperature Sensor Diagnosis", "Heater System Diagnosis", "Heater Matrix Diagnosis", "Auxiliary Heater Diagnosis", "Cooling System Flush", "Coolant Replacement",
    ],
  },
  {
    id: "emissions-exhaust",
    name: "Emissions & Exhaust",
    description: "Testing for exhaust, emissions-control, DPF, EGR, catalyst and AdBlue/SCR concerns.",
    services: [
      "Emissions System Diagnosis", "Exhaust System Diagnosis", "Exhaust Leak Diagnosis", "Exhaust System Repair", "DPF Diagnosis", "DPF Pressure System Diagnosis", "DPF Cleaning / Regeneration Assessment", "EGR System Diagnosis", "Oxygen / Lambda Sensor Diagnosis", "Exhaust Gas Temperature Sensor Diagnosis", "Catalytic Converter Diagnosis", "EVAP System Diagnosis", "AdBlue / SCR System Diagnosis",
    ],
  },
  {
    id: "brakes-stability",
    name: "Brakes, ABS & Stability Systems",
    description: "Inspection, diagnosis and repair of braking, ABS, traction and stability-control systems.",
    services: [
      "Brake System Inspection", "Brake System Diagnosis", "Brake Repair", "Brake Pad Replacement", "Brake Disc & Pad Replacement", "Brake Caliper Diagnosis & Repair", "Brake Fluid Inspection / Replacement", "ABS System Diagnosis", "ABS Sensor Diagnosis", "Traction Control System Diagnosis", "Electronic Stability Control Diagnosis", "Electronic Parking Brake Diagnosis", "Parking Brake Diagnosis & Repair",
    ],
  },
  {
    id: "steering-suspension-wheels",
    name: "Steering, Suspension & Wheels",
    description: "Checks and repairs for steering, suspension, wheel bearings, vibration and handling faults.",
    services: [
      "Steering System Diagnosis", "Power Steering System Diagnosis", "Suspension System Inspection", "Suspension System Diagnosis", "Suspension Repair", "Wheel Bearing Diagnosis", "Wheel Speed Sensor Diagnosis", "Tyre / Wheel Inspection", "Vibration Diagnosis", "Vehicle Pulling / Handling Diagnosis",
    ],
  },
  {
    id: "transmission-drivetrain",
    name: "Transmission & Drivetrain",
    description: "Assessment of gear selection, clutch, transmission, driveshaft and differential concerns.",
    services: [
      "Transmission System Diagnosis", "Automatic Transmission Assessment", "Manual Transmission Assessment", "Gear Selection Fault Diagnosis", "Clutch System Diagnosis", "Clutch Replacement", "Driveshaft / CV Joint Diagnosis", "Differential / Drivetrain Diagnosis",
    ],
  },
  {
    id: "battery-starting-charging",
    name: "Battery, Starting & Charging",
    description: "Battery health, starter, alternator, drive-belt and voltage-drop testing and repair.",
    services: [
      "Battery Health Test", "Battery Replacement", "Battery Registration / Coding", "Starting System Diagnosis", "Starter Motor Diagnosis", "Starter Motor Replacement", "Charging System Diagnosis", "Alternator Diagnosis", "Alternator Replacement", "Drive Belt Inspection / Replacement", "Voltage Drop Testing",
    ],
  },
  {
    id: "air-conditioning",
    name: "Air Conditioning & Climate Control",
    description: "Diagnosis of air-conditioning, climate-control, compressor, blower and cabin-temperature faults.",
    services: [
      "Air Conditioning System Diagnosis", "Climate Control System Diagnosis", "A/C Electrical Diagnosis", "A/C Pressure Assessment", "Compressor Diagnosis", "Blower Motor Diagnosis", "Cabin Temperature / Flap Motor Diagnosis", "Heater & Ventilation Diagnosis",
    ],
  },
  {
    id: "body-electrical",
    name: "Body Electrical & Convenience Systems",
    description: "Electrical fault finding for body-control, doors, windows, mirrors, seats, lighting and instruments.",
    services: [
      "Body Control System Diagnosis", "Door Electrical System Diagnosis", "Central Locking Diagnosis", "Keyless Entry System Diagnosis", "Electric Window Diagnosis", "Electric Mirror Diagnosis", "Seat Electrical System Diagnosis", "Tailgate / Boot Electrical Diagnosis", "Fuel Flap System Diagnosis", "Interior Lighting Diagnosis", "Exterior Lighting Diagnosis", "Instrument Cluster Diagnosis",
    ],
  },
  {
    id: "safety-driver-assistance",
    name: "Safety & Driver Assistance",
    description: "Assessment of restraint, parking-assistance, camera, TPMS, cruise-control and ADAS warning systems.",
    services: [
      "Airbag / SRS System Diagnosis", "Seat Belt System Diagnosis", "Parking Assistance System Diagnosis", "Parking Sensor Diagnosis", "Reversing Camera Diagnosis", "ADAS Warning System Assessment", "TPMS Diagnosis", "Cruise Control System Diagnosis",
    ],
  },
  {
    id: "inspection-assessment",
    name: "Inspection & Assessment",
    description: "Independent vehicle checks, diagnostic scans, roadworthiness assessments and second-opinion investigations.",
    services: [
      "Pre-Purchase Vehicle Inspection", "Vehicle Health Check", "Diagnostic Health Scan", "Used Vehicle Assessment", "Auction Vehicle Inspection", "Roadworthiness Test Failure Assessment", "Roadworthiness Test Advisory Assessment", "Electrical System Assessment", "Mechanical System Assessment", "Road Test & Diagnostic Assessment", "Post-Repair Verification", "Second Opinion / Diagnostic Assessment",
    ],
  },
  {
    id: "general-repair-maintenance",
    name: "General Repair & Maintenance",
    description: "Practical servicing, maintenance and general mechanical or electrical repair work.",
    services: [
      "General Mechanical Repair", "General Electrical Repair", "Service & Maintenance", "Oil & Filter Service", "Air Filter Replacement", "Cabin Filter Replacement", "Fuel Filter Replacement", "Spark Plug Replacement", "Glow Plug Diagnosis / Replacement", "Auxiliary Belt Replacement", "Bulb / Lighting Repair", "Hose / Pipe Replacement", "Fluid Leak Diagnosis", "Fluid Level / Condition Inspection",
    ],
  },
] as const satisfies readonly ServiceCatalogueCategory[];

export const serviceCatalogueNames = [...new Set(serviceCatalogue.flatMap((category) => category.services))];
