import "server-only";

import { renderPasswordChanged, renderPasswordReset } from "./templates/auth";
import { renderBookingEmail } from "./templates/bookings";
import { renderBusinessEnquiryNotification, renderEnquiryReceived, renderEnquiryReply, type EnquiryTemplateInput } from "./templates/enquiries";
import { renderInvoiceEmail } from "./templates/invoice";

const enquiry: EnquiryTemplateInput = {
  enquiryId: "8db05a20-006b-4b50-b10c-83b091ee54ad",
  type: "vehicle_diagnostics",
  customerName: "Alexandra Montgomery-Smythe",
  customerEmail: "alexandra@example.com",
  phone: "07123 456789",
  preferredContact: "email",
  service: "Vehicle diagnostics and intermittent electrical fault investigation",
  vehicle: "AB12 CDE · Vauxhall Astra Elite Nav Turbo",
  location: "DN6 9HF",
  description: "The warning light appears intermittently after a long drive. Please check the charging system and stored fault codes.\nThe vehicle remains driveable.",
};

const booking = {
  customerName: "Alexandra Montgomery-Smythe",
  reference: "SOB-12345678901234567890",
  service: "Vehicle diagnostics and intermittent electrical fault investigation",
  vehicle: "AB12 CDE · Vauxhall Astra Elite Nav Turbo",
  date: "Thursday, 20 August 2026",
  time: "10:30",
  location: "SOB Autofix workshop, Cumbrae, Station Road, Norton, Doncaster, DN6 9HF",
};

const invoice = {
  customerName: "Alexandra Montgomery-Smythe",
  invoiceNumber: "SOB-2026-000123-EXTENDED-REFERENCE",
  amount: "£185.00",
  issueDate: "13 August 2026",
  dueDate: "20 August 2026",
  vehicle: "AB12 CDE · Vauxhall Astra Elite Nav Turbo",
};

export function emailPreviewFixtures() {
  return {
    "enquiry-received": renderEnquiryReceived(enquiry),
    "enquiry-business-notification": renderBusinessEnquiryNotification(enquiry),
    "enquiry-reply": renderEnquiryReply({ customerName: enquiry.customerName, body: `${enquiry.description}\n\nWe can inspect this on Thursday.` }),
    "booking-confirmed": renderBookingEmail({ ...booking, type: "confirmed" }),
    "booking-rescheduled": renderBookingEmail({ ...booking, type: "rescheduled" }),
    "booking-cancelled": renderBookingEmail({ ...booking, type: "cancelled" }),
    "invoice-unpaid": renderInvoiceEmail({ ...invoice, status: "issued" }),
    "invoice-paid": renderInvoiceEmail({ ...invoice, status: "paid", paymentDate: "13 August 2026 at 14:20", paymentMethod: "Card" }),
    "password-reset": renderPasswordReset({ actionUrl: "https://example.supabase.co/auth/v1/verify?token=preview&type=recovery" }),
    "password-changed": renderPasswordChanged(),
  };
}
