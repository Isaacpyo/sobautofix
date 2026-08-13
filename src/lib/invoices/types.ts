export const invoiceStatuses = ["draft", "issued", "paid", "void"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];
export type InvoiceSourceType = "booking" | "enquiry" | "manual";
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "other";

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: string;
  unit_price_pence: number | string;
  line_total_pence: number | string;
  position: number;
};

export type Invoice = {
  id: string; invoice_number: string | null; invoice_year: number | null; invoice_sequence: number | string | null; revision: number | string; status: InvoiceStatus; source_type: InvoiceSourceType;
  booking_id: string | null; enquiry_id: string | null; customer_id: string | null; vehicle_id: string | null;
  replaces_invoice_id: string | null;
  currency: "GBP"; customer_name: string; customer_email: string | null; customer_phone: string | null;
  customer_address: string | null; vehicle_registration: string | null; vehicle_make: string | null; vehicle_model: string | null;
  service_name: string | null; appointment_start: string | null; issue_date: string | null; due_date: string | null;
  issuer_legal_name: string; issuer_trading_name: string; issuer_tagline: string; issuer_address: string;
  issuer_email: string; issuer_phone: string; issuer_company_number: string;
  subtotal_pence: number | string; discount_pence: number | string; tax_pence: number | string; total_pence: number | string;
  notes: string | null; payment_terms: string | null; issued_at: string | null; paid_at: string | null;
  payment_method: PaymentMethod | null; payment_reference: string | null; voided_at: string | null;
  created_by: string | null; updated_by: string | null; created_at: string; updated_at: string; invoice_items: InvoiceItem[];
};

export function invoiceStatusLabel(status: InvoiceStatus) {
  if (status === "issued") return "Unpaid";
  if (status === "paid") return "Paid / Settled";
  if (status === "void") return "Void";
  return "Draft";
}

export function sourceLabel(source: InvoiceSourceType) {
  return source === "booking" ? "Booking" : source === "enquiry" ? "Enquiry" : "Manual";
}
