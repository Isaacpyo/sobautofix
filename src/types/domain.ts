export type ServiceDeliveryType = "in_house" | "mobile" | "outsourced_specialist";

export type ServicePrice = {
  minimum?: number;
  maximum?: number;
  label?: string;
  notes?: string;
};

export type VehicleDetails = {
  registration: string;
  make?: string;
  model?: string;
  derivative?: string;
  year?: number;
  colour?: string;
  fuelType?: string;
  transmission?: string;
  engineCapacityCc?: number;
  bodyType?: string;
};

export type VehicleSession = {
  vehicle: VehicleDetails | null;
  vehicleConfirmed?: boolean;
  selectedProblem?: string;
  selectedService?: string;
  source?: string;
};

export type CustomerContact = {
  name: string;
  email?: string;
  phone: string;
  preferredContact: "phone" | "whatsapp" | "email";
};

export const enquiryTypes = [
  "repair",
  "diagnostic",
  "mobile",
  "inspection",
  "fleet",
  "recovery",
  "vehicle_sales",
  "general",
] as const;

export type EnquiryType = (typeof enquiryTypes)[number];
export type EnquiryStatus = "new" | "contacted" | "booked" | "closed";

export type Enquiry = {
  id: string;
  type: EnquiryType;
  contact: CustomerContact;
  vehicle?: VehicleDetails;
  serviceSlug?: string;
  description?: string;
  locationPostcode?: string;
  driveable?: boolean;
  status: EnquiryStatus;
  notificationStatus: "pending" | "sent" | "failed";
  createdAt: string;
};

export type SaleVehicleStatus = "draft" | "available" | "reserved" | "sold" | "archived";

export type SaleVehicle = {
  id: string;
  registration?: string;
  slug: string;
  make: string;
  model: string;
  derivative?: string;
  year: number;
  mileage: number;
  price: number;
  fuelType: string;
  transmission: string;
  engineSize?: string;
  colour?: string;
  bodyType?: string;
  description: string;
  features: string[];
  images: Array<{ id: string; url: string; alt: string; position: number }>;
  warranty?: { available: boolean; description?: string };
  financeAvailable?: boolean;
  status: SaleVehicleStatus;
  soldAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContentKind =
  | "core_page"
  | "service"
  | "diagnostic"
  | "area"
  | "article"
  | "faq";

export type PublicationStatus = "draft" | "scheduled" | "published" | "archived";

export type ContentSection =
  | { type: "hero"; eyebrow?: string; title: string; body: string; primaryCta?: string }
  | { type: "richText"; heading?: string; paragraphs: string[] }
  | { type: "serviceCards"; heading: string; slugs: string[] }
  | { type: "vehicleLookup"; heading?: string; body?: string }
  | { type: "symptomSelector"; heading: string }
  | { type: "process"; heading: string; steps: string[] }
  | { type: "trustFacts"; heading?: string; facts: Array<{ title: string; body: string }> }
  | { type: "offer"; offerId: string }
  | { type: "reviews"; heading: string }
  | { type: "areas"; heading: string }
  | { type: "gallery"; heading: string; category?: string; mediaIds?: string[] }
  | { type: "faqs"; heading: string; items: Array<{ question: string; answer: string }> }
  | { type: "relatedLinks"; heading: string; links: Array<{ label: string; href: string }> }
  | { type: "cta"; heading: string; body: string; label: string; href: string };

export type ContentEntry = {
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  excerpt: string;
  sections: ContentSection[];
  metadata: Record<string, unknown>;
  seoTitle: string;
  seoDescription: string;
  status: PublicationStatus;
  publishedAt?: string;
  updatedAt: string;
  authorId?: string;
};
