import "server-only";

import { emailUrl } from "@/lib/email/brand";
import { detailCard, detailsText, emailLayout, plainTextFooter, type RenderedEmail, type StatusTone } from "./components";

export type BookingEmailType = "confirmed" | "rescheduled" | "cancelled";
export type BookingEmailInput = {
  type: BookingEmailType;
  customerName: string;
  reference: string;
  service: string;
  vehicle: string;
  date: string;
  time: string;
  location: string;
};

const copy = {
  confirmed: { status: "BOOKING CONFIRMED", title: "You're booked in.", intro: "Your SOB Autofix appointment is confirmed.", tone: "success" as StatusTone },
  rescheduled: { status: "BOOKING UPDATED", title: "Your appointment has been rescheduled.", intro: "The new appointment date and time are shown below.", tone: "warning" as StatusTone },
  cancelled: { status: "BOOKING CANCELLED", title: "Your appointment has been cancelled.", intro: "Here is a record of the cancelled appointment.", tone: "cancelled" as StatusTone },
};

export function renderBookingEmail(input: BookingEmailInput): RenderedEmail {
  const details = [
    { label: "Date", value: input.date },
    { label: "Time", value: input.time },
    { label: "Service", value: input.service },
    { label: "Vehicle", value: input.vehicle },
    { label: "Location", value: input.location },
    { label: "Booking reference", value: input.reference },
  ];
  const isCancelled = input.type === "cancelled";
  const actionUrl = emailUrl(isCancelled ? "/book" : "/manage-booking");
  const actionLabel = isCancelled ? "Book another appointment" : "Manage booking";
  const item = copy[input.type];
  const preheader = input.type === "confirmed"
    ? `Your SOB Autofix appointment is confirmed for ${input.date} at ${input.time}.`
    : input.type === "rescheduled"
      ? "Your SOB Autofix appointment has a new date and time."
      : "Your SOB Autofix appointment has been cancelled.";
  return {
    html: emailLayout({
      preheader,
      status: item.status,
      tone: item.tone,
      title: item.title,
      intro: `Hello ${input.customerName}. ${item.intro}`,
      contentHtml: detailCard(details),
      cta: { label: actionLabel, url: actionUrl },
      afterCta: isCancelled ? "When you're ready, you can arrange another appointment online." : "Need to make a change? Use Manage Booking to review, reschedule or cancel your appointment.",
    }),
    text: ["SOB AUTOFIX", "", item.status, "", `Hello ${input.customerName},`, "", item.intro, "", detailsText(details), "", `${actionLabel}: ${actionUrl}`, plainTextFooter()].join("\n"),
  };
}
