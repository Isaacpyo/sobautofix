export const analyticsEvents = [
  "vehicle_lookup_started", "vehicle_lookup_success", "vehicle_lookup_failed",
  "diagnostic_service_viewed", "problem_selected", "service_selected",
  "booking_started", "booking_vehicle_confirmed", "booking_service_selected", "booking_slot_viewed", "booking_completed",
  "quote_started", "quote_submitted",
  "mobile_mechanic_started", "mobile_mechanic_submitted",
  "inspection_enquiry_submitted", "recovery_enquiry_submitted",
  "phone_clicked", "whatsapp_clicked", "directions_clicked",
  "vehicle_listing_viewed", "vehicle_sales_enquiry", "fleet_enquiry_submitted",
  "web_vital",
] as const;

export type AnalyticsEvent = (typeof analyticsEvents)[number];
type SafeValue = string | number | boolean;

const forbiddenKeys = new Set(["registration", "vehicle", "email", "phone", "postcode", "description", "problem"]);

export function sanitizeAnalyticsProperties(properties: Record<string, SafeValue> = {}) {
  return Object.fromEntries(Object.entries(properties).filter(([key]) => !forbiddenKeys.has(key.toLowerCase())));
}

export function track(event: AnalyticsEvent, properties?: Record<string, SafeValue>) {
  if (typeof window === "undefined") return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  gtag?.("event", event, sanitizeAnalyticsProperties(properties));
}
