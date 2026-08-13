import { z } from "zod";
import { calculateInvoiceTotals, poundsToPence, quantityToThousandths } from "./money";

const optionalText = (maximum: number) => z.string().trim().max(maximum).default("");
const optionalUuid = z.union([z.literal(""), z.string().uuid()]).default("");
const optionalDate = z.union([z.literal(""), z.iso.date()]).default("");

export const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, "Add an item description.").max(500),
  quantity: z.string().trim().refine((value) => { try { return quantityToThousandths(value) > 0n; } catch { return false; } }, "Enter a positive quantity with up to three decimal places."),
  unit_price_pence: z.string().regex(/^\d+$/, "Enter a valid unit price in pence.").refine((value) => BigInt(value) <= 999_999_999_999_999n, "Unit price is too large."),
});

export const invoiceDraftSchema = z.object({
  source_type: z.enum(["booking", "enquiry", "manual"]), booking_id: optionalUuid, enquiry_id: optionalUuid,
  customer_id: optionalUuid, vehicle_id: optionalUuid, customer_name: z.string().trim().min(2, "Add the customer name.").max(160),
  customer_email: z.union([z.literal(""), z.email()]).default(""), customer_phone: optionalText(40), customer_address: optionalText(500),
  vehicle_registration: optionalText(20), vehicle_make: optionalText(80), vehicle_model: optionalText(80), service_name: optionalText(160),
  appointment_start: z.union([z.literal(""), z.iso.datetime({ offset: true })]).default(""), issue_date: optionalDate, due_date: optionalDate,
  discount_pence: z.string().regex(/^\d+$/).default("0"), tax_pence: z.literal("0").default("0"),
  notes: optionalText(2_000), payment_terms: optionalText(1_000), items: z.array(invoiceItemInputSchema).min(1).max(100),
}).superRefine((value, context) => {
  if (value.source_type === "booking" && !value.booking_id) context.addIssue({ code: "custom", path: ["booking_id"], message: "Choose a booking." });
  if (value.source_type === "enquiry" && !value.enquiry_id) context.addIssue({ code: "custom", path: ["enquiry_id"], message: "Choose an enquiry." });
  if (value.issue_date && value.due_date && value.due_date < value.issue_date) context.addIssue({ code: "custom", path: ["due_date"], message: "Due date cannot be before the issue date." });
  try { calculateInvoiceTotals(value.items.map((item) => ({ quantity: item.quantity, unitPricePence: BigInt(item.unit_price_pence) })), BigInt(value.discount_pence)); }
  catch (error) { context.addIssue({ code: "custom", path: ["discount_pence"], message: error instanceof Error ? error.message : "Check the totals." }); }
});

export const paymentSchema = z.object({ invoiceId: z.string().uuid(), paidAt: z.iso.datetime({ offset: true }), method: z.enum(["cash", "card", "bank_transfer", "other"]), reference: z.string().trim().max(300).default("") });
export const sendInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  recipient: z.email(),
  intent: z.enum(["new", "retry"]).default("new"),
  logicalSendId: z.string().uuid(),
});
export function priceInputToPence(value: string) { return poundsToPence(value).toString(); }
export function friendlyInvoiceError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message || "Check the invoice details and try again.";
  if (!(error instanceof Error)) return "The invoice could not be saved. Please try again.";
  const known: Record<string, string> = {
    DRAFT_INVOICE_NOT_FOUND: "This draft no longer exists or has already been issued.",
    ISSUED_INVOICE_NOT_FOUND: "Only an unpaid issued invoice can use this action.",
    INVALID_INVOICE_STATUS_TRANSITION: "That status change is not allowed.",
    INVALID_INVOICE_TOTAL: "Check the invoice amounts and discount.",
    DUPLICATE_SOURCE_CONFIRMATION_REQUIRED: "An active invoice already exists for this source. Review it and explicitly confirm another draft.",
    SOURCE_RELATIONSHIP_MISMATCH: "The selected source no longer matches its customer or vehicle. Reload it before invoicing.",
    VAT_NOT_CONFIGURED: "VAT is not configured and cannot be added to this invoice.",
    PAYMENT_DATE_REQUIRED: "Enter the payment date.",
    PAYMENT_METHOD_REQUIRED: "Choose the payment method.",
  };
  const knownMessage = known[error.message];
  if (knownMessage) return knownMessage;
  return error.message.includes("discount_pence") ? "Discount cannot exceed the invoice amount." : "The invoice action could not be completed. Please try again.";
}
