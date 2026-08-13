import "server-only";

import { emailUrl } from "@/lib/email/brand";
import { detailCard, detailsText, emailLayout, plainTextFooter, textToHtml, type RenderedEmail } from "./components";

export type EnquiryTemplateInput = {
  enquiryId: string;
  type: string;
  customerName: string;
  customerEmail?: string;
  phone: string;
  preferredContact: string;
  service?: string;
  vehicle?: string;
  location?: string;
  description: string;
};

function typeLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function renderEnquiryReceived(input: EnquiryTemplateInput): RenderedEmail {
  const details = [
    { label: "Request reference", value: input.enquiryId },
    { label: "Service", value: input.service || typeLabel(input.type) },
    { label: "Vehicle", value: input.vehicle },
    { label: "Preferred contact", value: typeLabel(input.preferredContact) },
  ];
  const url = emailUrl("/");
  return {
    html: emailLayout({
      preheader: "We've received your SOB Autofix request and will review it shortly.",
      status: "REQUEST RECEIVED",
      tone: "info",
      title: `Thanks, ${input.customerName}.`,
      intro: "We've received your request. Our team will review the details and respond using your preferred contact method.",
      contentHtml: detailCard(details),
      cta: { label: "Visit SOB Autofix", url },
    }),
    text: ["SOB AUTOFIX", "", "REQUEST RECEIVED", "", `Hello ${input.customerName},`, "", "We've received your request. Our team will review the details and respond using your preferred contact method.", "", detailsText(details), "", `Visit SOB Autofix: ${url}`, plainTextFooter()].join("\n"),
  };
}

export function renderBusinessEnquiryNotification(input: EnquiryTemplateInput): RenderedEmail {
  const details = [
    { label: "Customer", value: input.customerName },
    { label: "Phone", value: input.phone },
    { label: "Email", value: input.customerEmail },
    { label: "Preferred contact", value: typeLabel(input.preferredContact) },
    { label: "Vehicle", value: input.vehicle },
    { label: "Location", value: input.location },
  ];
  const url = emailUrl(`/admin/enquiries/${input.enquiryId}`);
  return {
    html: emailLayout({
      preheader: `${typeLabel(input.type)} enquiry from ${input.customerName}.`,
      status: "NEW ENQUIRY",
      tone: "info",
      title: typeLabel(input.type),
      intro: "A new customer request is ready to review.",
      contentHtml: `${detailCard(details)}<div style="margin-top:22px;"><p style="margin:0 0 8px;color:#586575;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Problem</p><div style="padding:16px 18px;border:1px solid #DCE6F2;border-radius:12px;color:#071127;font-size:15px;line-height:23px;overflow-wrap:anywhere;">${textToHtml(input.description)}</div></div>`,
      cta: { label: "View enquiry", url },
    }),
    text: ["SOB AUTOFIX", "", "NEW ENQUIRY", "", typeLabel(input.type), "", detailsText(details), "", "Problem:", input.description, "", `View enquiry: ${url}`, plainTextFooter()].join("\n"),
  };
}

export function renderEnquiryReply(input: { customerName: string; body: string }): RenderedEmail {
  return {
    html: emailLayout({
      preheader: `A reply from SOB Autofix for ${input.customerName}.`,
      status: "SOB AUTOFIX",
      tone: "info",
      title: `Hello ${input.customerName},`,
      contentHtml: `<div style="color:#071127;font-size:16px;line-height:25px;overflow-wrap:anywhere;">${textToHtml(input.body)}</div><div style="margin:26px 0 18px;border-top:1px solid #DCE6F2;"></div><p style="margin:0;color:#586575;font-size:14px;line-height:22px;">Reply directly to this email to continue the conversation.</p>`,
      compact: true,
    }),
    text: [`Hello ${input.customerName},`, "", input.body, "", "Reply directly to this email to continue the conversation.", plainTextFooter()].join("\n"),
  };
}
