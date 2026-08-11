export const vehicleFeatureGroups = [
  {
    label: "Comfort & interior",
    features: [
      "Air conditioning", "Climate control", "Dual-zone climate control", "Three-zone climate control",
      "Heated front seats", "Heated rear seats", "Ventilated seats", "Massaging seats", "Heated steering wheel",
      "Leather upholstery", "Alcantara upholstery", "Electric front seats", "Driver seat memory", "Lumbar support",
      "Panoramic roof", "Sunroof", "Privacy glass", "Heated windscreen", "Ambient interior lighting",
    ],
  },
  {
    label: "Audio, navigation & connectivity",
    features: [
      "Apple CarPlay", "Wireless Apple CarPlay", "Android Auto", "Wireless Android Auto", "Bluetooth",
      "DAB digital radio", "Satellite navigation", "Touchscreen infotainment", "Digital cockpit", "Head-up display",
      "Wireless phone charging", "USB ports", "Voice control", "Premium sound system", "Steering wheel audio controls",
    ],
  },
  {
    label: "Parking & cameras",
    features: [
      "Rear parking sensors", "Front parking sensors", "Front and rear parking sensors", "Reversing camera",
      "360-degree camera", "Park assist", "Self-parking system",
    ],
  },
  {
    label: "Safety & driver assistance",
    features: [
      "Cruise control", "Adaptive cruise control", "Speed limiter", "Lane departure warning", "Lane keeping assist",
      "Blind spot monitoring", "Traffic sign recognition", "Forward collision warning", "Automatic emergency braking",
      "Rear cross-traffic alert", "Driver attention alert", "Hill-start assist", "Hill-descent control",
      "Electronic stability control", "Traction control", "ISOFIX child seat points", "Tyre pressure monitoring",
    ],
  },
  {
    label: "Lighting & visibility",
    features: [
      "LED headlights", "Matrix LED headlights", "Xenon headlights", "Automatic headlights", "High beam assist",
      "Rain-sensing wipers", "Daytime running lights", "Front fog lights", "Heated door mirrors",
    ],
  },
  {
    label: "Exterior, access & practicality",
    features: [
      "Alloy wheels", "Electric folding door mirrors", "Keyless entry", "Keyless start", "Remote central locking",
      "Electric tailgate", "Powered sliding doors", "Roof rails", "Towbar", "Full-size spare wheel",
      "Space-saver spare wheel", "Seven seats", "Split-folding rear seats", "Adjustable boot floor",
    ],
  },
  {
    label: "Driving, performance & electrified",
    features: [
      "Stop/start system", "Drive mode selection", "Paddle shift", "Four-wheel drive", "Limited-slip differential",
      "Regenerative braking", "Rapid charging", "Home charging cable", "Public charging cable", "Heat pump",
    ],
  },
  {
    label: "Security",
    features: ["Alarm", "Engine immobiliser", "Locking wheel nuts", "Two keys"],
  },
] as const;

export const commonVehicleFeatures = vehicleFeatureGroups.flatMap((group) => group.features);
