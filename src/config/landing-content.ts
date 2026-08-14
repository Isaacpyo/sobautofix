import type { EnquiryType } from "@/types/domain";

export type LandingContent = {
  eyebrow: string;
  title: string;
  body: string;
  introHeading: string;
  paragraphs: string[];
  highlights: Array<{ title: string; body: string }>;
  process?: string[];
  faqs?: Array<{ question: string; answer: string }>;
  enquiryType?: EnquiryType;
  askLocation?: boolean;
};

export const topLevelContent: Record<string, LandingContent> = {
  about: {
    eyebrow: "About SOB Autofix",
    title: "Diagnosis-led automotive care",
    body: "SOB Autofix Limited combines professional vehicle diagnostics, electrical fault finding and practical repair work for Doncaster and South Yorkshire.",
    introHeading: "Diagnose first. Repair second.",
    paragraphs: ["Replacing parts without identifying the cause can become expensive quickly. Our approach starts with the symptoms, scans the relevant systems and follows the evidence with targeted tests.", "Customers receive an explanation of what has been found and the sensible next step before repair work proceeds. Mobile appointments, workshop work, inspections, recovery coordination and used vehicle sales are handled with the same direct, professional approach."],
    highlights: [
      { title: "4 years in business", body: "An established local automotive business serving Doncaster and surrounding areas." },
      { title: "Technical training", body: "NABTEB and Automotive Service Management Certificate credentials supplied by the business." },
      { title: "Workshop + mobile", body: "The right delivery route depends on the fault, vehicle condition and work required." },
    ],
  },
  "mobile-mechanic": {
    eyebrow: "Mobile automotive support",
    title: "Mobile Mechanic in Doncaster",
    body: "Diagnostics and suitable repair work at your location, with clear advice when workshop attention or recovery is the safer next step.",
    introHeading: "Start with the vehicle, location and symptoms.",
    paragraphs: ["Mobile work is particularly useful for warning lights, non-starting vehicles, battery and charging concerns, and electrical faults that can be assessed safely at the vehicle’s location.", "Availability depends on the problem and area. Submit the details or call to confirm current appointment options."],
    highlights: [
      { title: "Mobile diagnostics", body: "System scanning and targeted checks where the vehicle is located." },
      { title: "Starting and charging", body: "Battery, alternator, drain and starting-circuit assessment." },
      { title: "Appropriate repairs", body: "Suitable mobile work after the underlying issue has been assessed." },
      { title: "Coverage areas", body: "Workshop and mobile availability is confirmed using the service, vehicle condition and postcode." },
    ],
    process: ["Identify the vehicle", "Share the postcode and symptoms", "Confirm whether it can be driven", "We review the appropriate appointment route"],
    enquiryType: "mobile",
    askLocation: true,
  },
  "vehicle-inspections": {
    eyebrow: "Vehicle inspections",
    title: "Pre-Purchase Vehicle Inspection in Doncaster",
    body: "Get a clearer view of a vehicle’s visible mechanical condition and diagnostic health before deciding whether to buy.",
    introHeading: "More information before you commit.",
    paragraphs: ["A pre-purchase inspection brings together a visual mechanical assessment, vehicle health observations and an electronic system scan where appropriate.", "An inspection reflects the vehicle and access available at the time. It reduces uncertainty but cannot guarantee that a used vehicle will never develop a future fault."],
    highlights: [
      { title: "Diagnostic scan", body: "Review relevant electronic systems and recorded faults." },
      { title: "Visual assessment", body: "Inspect accessible mechanical components and general condition." },
      { title: "Clear findings", body: "Explain observations so you can make a more informed decision." },
    ],
    enquiryType: "inspection",
    askLocation: true,
  },
  "vehicle-recovery": {
    eyebrow: "Vehicle recovery",
    title: "Vehicle Recovery in Doncaster",
    body: "Request vehicle recovery availability and explain where the vehicle is, what happened and where it needs to go.",
    introHeading: "A practical route when the vehicle cannot be moved safely.",
    paragraphs: ["Recovery availability depends on location, vehicle condition and current capacity. Share accurate details so the request can be assessed.", "No fixed attendance time is promised through the website. If the situation involves immediate danger, contact the appropriate emergency service."],
    highlights: [
      { title: "Location first", body: "Provide the current postcode and a useful description of the position." },
      { title: "Vehicle context", body: "Tell us the registration and whether the vehicle rolls, steers and starts." },
      { title: "Availability confirmed", body: "We will explain the current recovery options after reviewing the request." },
    ],
    enquiryType: "recovery",
    askLocation: true,
  },
  fleet: {
    eyebrow: "Fleet servicing",
    title: "Diagnostics and Maintenance for Doncaster Fleets",
    body: "Discuss a practical servicing, diagnostic and repair approach for the vehicles your organisation relies on.",
    introHeading: "Keep vehicle decisions evidence-led.",
    paragraphs: ["Fleet requirements vary by vehicle type, usage, mileage and operating schedule. SOB Autofix can discuss diagnostics, electrical repairs, preventative maintenance, health checks and repair coordination.", "There are no invented packages or fixed fleet prices. We will review the fleet requirements and propose an appropriate arrangement."],
    highlights: [
      { title: "Diagnostics", body: "Investigate warning lights and reported faults before parts decisions." },
      { title: "Preventative care", body: "Plan servicing and health checks around real vehicle usage." },
      { title: "Repair coordination", body: "Create clearer next steps across mobile, workshop and specialist work." },
    ],
    enquiryType: "fleet",
  },
};

export const legalContent: Record<string, { title: string; description: string; sections: Array<{ heading: string; body: string[] }> }> = {
  privacy: {
    title: "Privacy notice",
    description: "How SOB Autofix Limited handles information submitted through this website.",
    sections: [
      { heading: "Information we collect", body: ["When you submit an enquiry, we collect the contact, vehicle, location and problem information needed to respond. Optional photographs are stored privately.", "Anonymous vehicle lookups are not permanently stored. A confirmed vehicle is retained in tab-scoped session storage until the tab is closed or you remove it."] },
      { heading: "How information is used", body: ["Information is used to assess your request, contact you, arrange work, maintain enquiry records and protect the service from misuse. Registrations and free-text problem descriptions are excluded from analytics."] },
      { heading: "Retention and service providers", body: ["Closed ordinary enquiries and their private attachments are scheduled for deletion or anonymisation after 12 months unless information must be retained separately as a customer record for a justified purpose.", "The website uses contracted infrastructure, email, scheduling, analytics, security and communication providers. Optional analytics and live chat load only after the relevant consent."] },
      { heading: "Your choices", body: ["You may ask what personal information is held, request correction, or ask for deletion where applicable by emailing info@sobautofix.com. This operational notice must be reviewed with the business’s final legal requirements before production launch."] },
    ],
  },
  cookies: {
    title: "Cookie notice",
    description: "Essential storage and optional website technologies used by SOB Autofix.",
    sections: [
      { heading: "Essential storage", body: ["The site uses essential browser storage for security, admin authentication, privacy preferences and the active vehicle journey. The vehicle journey is tab-scoped rather than stored permanently."] },
      { heading: "Optional analytics and chat", body: ["Google Analytics loads only after analytics consent. Live chat loads only after functional consent. You can reject both and continue to use the main website and enquiry routes."] },
      { heading: "Changing your choice", body: ["Clear the site’s local storage to reset the current preference. A dedicated preference control can also be added when the final production consent configuration is approved."] },
    ],
  },
  terms: {
    title: "Website terms",
    description: "Important information about using the SOB Autofix website and enquiry services.",
    sections: [
      { heading: "Website information", body: ["Website content is general information and does not constitute a diagnosis. A vehicle must be assessed and tested before the cause of a fault or repair scope can be confirmed."] },
      { heading: "Estimates and appointments", body: ["An online request does not guarantee a price, response time or appointment. Estimates may change when inspection reveals additional work. Use the booking calendar or contact SOB Autofix to check current availability."] },
      { heading: "Vehicle sales", body: ["Finance options may be available on selected vehicles. Contact us for details. Warranty information is vehicle-specific and applies only where shown in the individual listing."] },
      { heading: "Final approval", body: ["These operational terms must be reviewed and approved by the business before production launch."] },
    ],
  },
};
