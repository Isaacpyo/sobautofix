import "server-only";

import { emailUrl } from "@/lib/email/brand";
import { detailCard, detailsText, emailLayout, notice, plainTextFooter, textToHtml, type Detail, type RenderedEmail } from "./components";

// SOB Auto Exchange emails: customer acknowledgements and staff notifications.
// Customer emails never promise a confirmed appointment, an offer or a
// response time unless staff have published one in settings.

export type ExchangeEmailBrand = { exchangeName: string; exchangeUrl: string };

const contactLabels: Record<string, string> = { phone: "Phone call", whatsapp: "WhatsApp", email: "Email" };

function label(value?: string) {
  return value ? contactLabels[value] || value : undefined;
}

export type ViewingEmailInput = ExchangeEmailBrand & {
  enquiryId: string;
  intent: "viewing" | "question";
  customerName: string;
  customerEmail?: string;
  phone: string;
  preferredContact: string;
  vehicleName: string;
  vehiclePrice: string;
  vehicleUrl: string;
  stockReference?: string;
  requestedTime?: string;
  alternativeTime?: string;
  message?: string;
};

export function renderVehicleEnquiryReceived(input: ViewingEmailInput): RenderedEmail {
  const viewing = input.intent === "viewing";
  const details: Detail[] = [
    { label: "Car", value: input.vehicleName },
    { label: "Price", value: input.vehiclePrice },
    { label: "Requested time (not yet confirmed)", value: viewing ? input.requestedTime : undefined },
    { label: "Alternative time", value: viewing ? input.alternativeTime : undefined },
    { label: "We will contact you by", value: label(input.preferredContact) },
  ];
  const intro = viewing
    ? "Thanks for your viewing request. It is not confirmed yet: a member of our team will contact you to confirm the time or suggest another."
    : "Thanks for your question. A member of our team will reply using your preferred contact method.";
  const status = viewing ? "VIEWING REQUESTED" : "QUESTION RECEIVED";
  return {
    html: emailLayout({
      preheader: viewing ? `Your viewing request for the ${input.vehicleName} is awaiting confirmation.` : `We received your question about the ${input.vehicleName}.`,
      status,
      tone: "info",
      title: `Thanks, ${input.customerName}.`,
      intro,
      contentHtml: `${detailCard(details)}${viewing ? notice("Please wait for confirmation", "Your viewing is a request until we confirm it with you. We do not take payments or reservations online.") : ""}`,
      cta: { label: "View the car", url: input.vehicleUrl },
    }),
    text: [input.exchangeName.toUpperCase(), "", status, "", `Hello ${input.customerName},`, "", intro, "", detailsText(details), "", `View the car: ${input.vehicleUrl}`, plainTextFooter()].join("\n"),
  };
}

export function renderVehicleEnquiryStaffNotification(input: ViewingEmailInput): RenderedEmail {
  const viewing = input.intent === "viewing";
  const details: Detail[] = [
    { label: "Car", value: input.vehicleName },
    { label: "Stock reference", value: input.stockReference },
    { label: "Price", value: input.vehiclePrice },
    { label: "Requested time", value: viewing ? input.requestedTime : undefined },
    { label: "Alternative time", value: viewing ? input.alternativeTime : undefined },
    { label: "Customer", value: input.customerName },
    { label: "Phone", value: input.phone },
    { label: "Email", value: input.customerEmail },
    { label: "Preferred contact", value: label(input.preferredContact) },
  ];
  const adminUrl = emailUrl(`/admin/exchange/sales/${input.enquiryId}`);
  const title = viewing ? "Viewing request" : "Question about a car";
  const messageBlock = input.message
    ? `<div style="margin-top:22px;"><p style="margin:0 0 8px;color:#586575;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Message</p><div style="padding:16px 18px;border:1px solid #DCE6F2;border-radius:12px;color:#071127;font-size:15px;line-height:23px;overflow-wrap:anywhere;">${textToHtml(input.message)}</div></div>`
    : "";
  return {
    html: emailLayout({
      preheader: `${title}: ${input.vehicleName}.`,
      status: viewing ? "VIEWING REQUESTED" : "NEW QUESTION",
      tone: viewing ? "warning" : "info",
      title,
      intro: viewing ? "A customer has requested a viewing. It is not confirmed until you confirm it in the diary." : "A customer has asked about one of our cars.",
      contentHtml: `${detailCard(details)}${messageBlock}`,
      cta: { label: viewing ? "Review and confirm" : "View enquiry", url: adminUrl },
    }),
    text: [input.exchangeName.toUpperCase(), "", title.toUpperCase(), "", detailsText(details), ...(input.message ? ["", "Message:", input.message] : []), "", `Open in admin: ${adminUrl}`, plainTextFooter()].join("\n"),
  };
}

export type SellerEmailInput = ExchangeEmailBrand & {
  submissionId: string;
  reference: string;
  kind: "sell" | "part_exchange";
  customerName: string;
  customerEmail?: string;
  phone: string;
  preferredContact: string;
  postcode?: string;
  vehicleSummary: string;
  registration?: string;
  mileage?: string;
  runningStatus?: string;
  outstandingFinance?: string;
  interestedVehicle?: string;
  photoCount: number;
  responsePromise?: string;
};

export function renderSellerSubmissionReceived(input: SellerEmailInput): RenderedEmail {
  const partExchange = input.kind === "part_exchange";
  const details: Detail[] = [
    { label: "Reference", value: input.reference },
    { label: "Your car", value: input.vehicleSummary },
    { label: "Part exchange towards", value: input.interestedVehicle },
    { label: "We will contact you by", value: label(input.preferredContact) },
  ];
  const next = input.responsePromise
    ? `We will review your details and contact you. ${input.responsePromise}`
    : "We will review your details and contact you using your preferred method.";
  const intro = `Thanks for telling us about your car. ${next}`;
  const caveat = "Any offer we make is provisional until we have inspected the car and checked its documents and history.";
  return {
    html: emailLayout({
      preheader: `We received your ${partExchange ? "part exchange" : "sell your car"} enquiry, reference ${input.reference}.`,
      status: "ENQUIRY RECEIVED",
      tone: "info",
      title: `Thanks, ${input.customerName}.`,
      intro,
      contentHtml: `${detailCard(details)}${notice("About offers", caveat)}`,
      cta: { label: `Visit ${input.exchangeName}`, url: input.exchangeUrl },
    }),
    text: [input.exchangeName.toUpperCase(), "", "ENQUIRY RECEIVED", "", `Hello ${input.customerName},`, "", intro, "", detailsText(details), "", caveat, "", `Visit ${input.exchangeName}: ${input.exchangeUrl}`, plainTextFooter()].join("\n"),
  };
}

export function renderSellerSubmissionStaffNotification(input: SellerEmailInput): RenderedEmail {
  const partExchange = input.kind === "part_exchange";
  const details: Detail[] = [
    { label: "Reference", value: input.reference },
    { label: "Type", value: partExchange ? "Part exchange" : "Sell your car" },
    { label: "Car", value: input.vehicleSummary },
    { label: "Registration", value: input.registration },
    { label: "Mileage", value: input.mileage },
    { label: "Running", value: input.runningStatus },
    { label: "Outstanding finance", value: input.outstandingFinance },
    { label: "Part exchange towards", value: input.interestedVehicle },
    { label: "Photos selected", value: String(input.photoCount) },
    { label: "Customer", value: input.customerName },
    { label: "Phone", value: input.phone },
    { label: "Email", value: input.customerEmail },
    { label: "Postcode", value: input.postcode },
    { label: "Preferred contact", value: label(input.preferredContact) },
  ];
  const adminUrl = emailUrl(`/admin/exchange/buying/${input.submissionId}`);
  return {
    html: emailLayout({
      preheader: `${partExchange ? "Part exchange" : "Sell your car"} enquiry ${input.reference}: ${input.vehicleSummary}.`,
      status: "NEW SELLER ENQUIRY",
      tone: "info",
      title: partExchange ? "Part exchange enquiry" : "Sell your car enquiry",
      intro: "A customer wants to sell their car. Photos may still be uploading; open the enquiry to see them and the full condition details.",
      contentHtml: detailCard(details),
      cta: { label: "Review enquiry", url: adminUrl },
    }),
    text: [input.exchangeName.toUpperCase(), "", "NEW SELLER ENQUIRY", "", detailsText(details), "", `Open in admin: ${adminUrl}`, plainTextFooter()].join("\n"),
  };
}
