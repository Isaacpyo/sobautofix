// SOB Auto Exchange: code defaults. Everything here can be overridden from
// Admin > Vehicle Buying & Selling > Settings, which stores only the fields
// staff change. Keep customer-facing promises out of the defaults: an empty
// string means "not published yet" and the page says so honestly.

export const EXCHANGE_DEFAULT_URL = "https://exchange.sobautofix.com";

export type ExchangePolicyKey = "vehicleSalesTerms" | "reservations" | "sellerPrivacy" | "complaints";

export type ExchangePublicSettings = {
  /** Tentative trading name. Change it in Settings; nothing else is hard-coded. */
  name: string;
  shortName: string;
  tagline: string;
  heroHeading: string;
  heroBody: string;
  phone: string;
  whatsapp: string;
  email: string;
  /** Opening hours shown on the contact page. Empty means "call to confirm". */
  openingHours: string;
  /** Shown on the seller completion screen only when staff have agreed it. */
  sellerResponsePromise: string;
  /** Steps and copy for the How Buying Works page. */
  buyingProcess: string;
  viewingInformation: string;
  paymentInformation: string;
  collectionDelivery: string;
  afterSales: string;
  warrantyInformation: string;
  partExchangeInformation: string;
  inspectionProcess: string;
  policies: Record<ExchangePolicyKey, string>;
};

export type ExchangePrivateSettings = {
  /** Staff who receive new enquiry, viewing and seller notifications. */
  notificationRecipients: string[];
  viewingLengthMinutes: number;
  minimumPublishPhotos: number;
  sellerRetentionMonths: number;
};

export const exchangePublicDefaults: ExchangePublicSettings = {
  name: "SOB Auto Exchange",
  shortName: "Auto Exchange",
  tagline: "Buy, sell and maintain your car with SOB Autofix.",
  heroHeading: "Your next car. Your current car. Your trusted workshop.",
  heroBody: "Explore our used cars, request an offer for your vehicle, or book repairs and diagnostics in Doncaster.",
  phone: "",
  whatsapp: "",
  email: "",
  openingHours: "",
  sellerResponsePromise: "",
  buyingProcess: "",
  viewingInformation: "",
  paymentInformation: "",
  collectionDelivery: "",
  afterSales: "",
  warrantyInformation: "",
  partExchangeInformation: "",
  inspectionProcess: "",
  policies: { vehicleSalesTerms: "", reservations: "", sellerPrivacy: "", complaints: "" },
};

export const exchangePrivateDefaults: ExchangePrivateSettings = {
  notificationRecipients: [],
  viewingLengthMinutes: 45,
  minimumPublishPhotos: 4,
  sellerRetentionMonths: 12,
};

export const exchangePolicyPages: Array<{ key: ExchangePolicyKey; slug: string; title: string }> = [
  { key: "vehicleSalesTerms", slug: "vehicle-sales-terms", title: "Vehicle sales terms" },
  { key: "reservations", slug: "reservations", title: "Reservations and cancellations" },
  { key: "sellerPrivacy", slug: "selling-your-car-privacy", title: "Selling your car: how we use your information" },
  { key: "complaints", slug: "complaints", title: "Complaints" },
];

/** Placeholder shown wherever staff have not yet published approved copy. */
export const NOT_PUBLISHED_COPY = "We are finalising this information. Please contact us and we will confirm the current arrangements before you commit.";

/** Shown wherever a vehicle fact has not been confirmed. Never replace with a reassuring guess. */
export const NOT_CONFIRMED = "Not confirmed";

export function exchangeBaseUrl() {
  return (process.env.NEXT_PUBLIC_EXCHANGE_URL || EXCHANGE_DEFAULT_URL).replace(/\/$/, "");
}
