import { z } from "zod";

export const productionEmailSender = "SOB Autofix <notifications@sobautofix.com>";
export const approvedBookingReplyTo = "info@sobautofix.com";
export const approvedEnquiryFallbackReplyTo = "info@sobautofix.com";
export const approvedInvoiceReplyTo = "info@sobautofix.com";

const emailAddress = z.email();

export function parseEmailAddress(value: string) {
  return emailAddress.parse(value);
}

export function isValidEmailAddress(value: string | undefined) {
  return Boolean(value && emailAddress.safeParse(value).success);
}

export function resolveReplyTo(defaultReplyTo: string, requestedReplyTo?: string) {
  return parseEmailAddress(requestedReplyTo ?? defaultReplyTo);
}
