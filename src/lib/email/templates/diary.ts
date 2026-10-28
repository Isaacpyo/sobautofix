import "server-only";

import { detailCard, detailsText, emailLayout, notice, plainTextFooter, type RenderedEmail, type StatusTone } from "./components";

// Emails to a customer about a vehicle viewing they asked for on the
// exchange. They state only what staff have confirmed: the car, the date and
// time (UK time) and where to come. No promises about the car's condition,
// availability beyond the appointment, or response times.

export type ViewingEmailType = "confirmed" | "rescheduled" | "proposed" | "cancelled";

export type ViewingEmailInput = {
  type: ViewingEmailType;
  businessName: string;
  customerName: string;
  vehicle: string;
  /** "Friday 30 October 2026 at 11:00" (UK time). */
  when: string;
  /** For rescheduled and proposed emails. */
  previousWhen?: string;
  address: string;
  contactPhone?: string;
  /** Staff note for proposed times or the reason for a cancellation. */
  message?: string | null;
};

const copy: Record<ViewingEmailType, { status: string; tone: StatusTone; title: (input: ViewingEmailInput) => string; intro: (input: ViewingEmailInput) => string; subject: (input: ViewingEmailInput) => string }> = {
  confirmed: {
    status: "VIEWING CONFIRMED",
    tone: "success",
    title: () => "Your viewing is confirmed.",
    intro: (input) => `Thanks, ${input.customerName}. We look forward to showing you the car.`,
    subject: (input) => `Viewing confirmed: ${input.vehicle}, ${input.when}`,
  },
  rescheduled: {
    status: "VIEWING MOVED",
    tone: "warning",
    title: () => "Your viewing has a new time.",
    intro: (input) => `Hello ${input.customerName}, your viewing has moved to the time below.`,
    subject: (input) => `Viewing moved: ${input.vehicle}, now ${input.when}`,
  },
  proposed: {
    status: "NEW TIME SUGGESTED",
    tone: "info",
    title: () => "Could you make this time instead?",
    intro: (input) => `Hello ${input.customerName}, we cannot do the time you asked for, so we have suggested another below. Please reply to this email or call us to confirm. Your viewing is not booked until we confirm it.`,
    subject: (input) => `Viewing request: can you make ${input.when}?`,
  },
  cancelled: {
    status: "VIEWING CANCELLED",
    tone: "cancelled",
    title: () => "Your viewing has been cancelled.",
    intro: (input) => `Hello ${input.customerName}, we are sorry, but we have had to cancel the viewing below.`,
    subject: (input) => `Viewing cancelled: ${input.vehicle}`,
  },
};

export function viewingEmailSubject(input: ViewingEmailInput) {
  return copy[input.type].subject(input);
}

export function renderViewingEmail(input: ViewingEmailInput): RenderedEmail & { subject: string } {
  const text = copy[input.type];
  const timeLabel = input.type === "proposed" ? "Suggested time" : input.type === "cancelled" ? "Was booked for" : "Date and time";
  const details = [
    { label: "Vehicle", value: input.vehicle },
    { label: timeLabel, value: `${input.when} (UK time)` },
    { label: input.type === "proposed" ? "You asked for" : "Previously", value: input.type === "rescheduled" || input.type === "proposed" ? input.previousWhen : undefined },
    { label: "Address", value: input.type === "cancelled" ? undefined : input.address },
  ];
  const messageTitle = input.type === "cancelled" ? "Reason" : "A note from the team";
  const contact = input.contactPhone ? `Reply to this email or call ${input.contactPhone} if you have any questions.` : "Reply to this email if you have any questions.";
  return {
    subject: text.subject(input),
    html: emailLayout({
      preheader: text.subject(input),
      status: text.status,
      tone: text.tone,
      title: text.title(input),
      intro: text.intro(input),
      contentHtml: `${detailCard(details)}${input.message ? notice(messageTitle, input.message) : ""}`,
      afterCta: contact,
    }),
    text: [
      input.businessName.toUpperCase(),
      "",
      text.status,
      "",
      text.intro(input),
      "",
      detailsText(details),
      ...(input.message ? ["", `${messageTitle}: ${input.message}`] : []),
      "",
      contact,
      plainTextFooter(),
    ].join("\n"),
  };
}
