import "server-only";

import { detailCard, detailsText, emailLayout, notice, plainTextFooter, type RenderedEmail } from "./components";

export type InvoiceEmailInput = {
  status: "issued" | "paid";
  customerName: string;
  invoiceNumber: string;
  amount: string;
  issueDate: string;
  dueDate?: string;
  vehicle?: string;
  paymentDate?: string;
  paymentMethod?: string;
};

export function renderInvoiceEmail(input: InvoiceEmailInput): RenderedEmail {
  const paid = input.status === "paid";
  const details = [
    { label: "Invoice number", value: input.invoiceNumber },
    { label: "Issue date", value: input.issueDate },
    { label: "Due date", value: paid ? undefined : input.dueDate },
    { label: "Vehicle", value: input.vehicle },
    { label: "Amount", value: input.amount },
    { label: "Payment status", value: paid ? "Paid / Settled" : "Unpaid" },
    { label: "Payment date", value: paid ? input.paymentDate : undefined },
    { label: "Payment method", value: paid ? input.paymentMethod : undefined },
  ];
  const attachmentCopy = paid ? "A copy of your invoice is attached for your records." : "Your SOB Autofix invoice is attached as a PDF.";
  return {
    html: emailLayout({
      preheader: `Invoice ${input.invoiceNumber} is attached.`,
      status: paid ? "PAID / SETTLED" : "INVOICE · UNPAID",
      tone: paid ? "success" : "info",
      title: `Invoice ${input.invoiceNumber}`,
      intro: `Hello ${input.customerName}. ${attachmentCopy}`,
      contentHtml: `<p style="margin:0 0 22px;color:#071127;font-size:30px;font-weight:700;line-height:36px;">${input.amount}</p>${detailCard(details)}${notice("PDF invoice attached", attachmentCopy)}`,
    }),
    text: ["SOB AUTOFIX", "", paid ? "PAID / SETTLED" : "INVOICE · UNPAID", "", `Invoice ${input.invoiceNumber}`, input.amount, "", `Hello ${input.customerName},`, "", attachmentCopy, "", detailsText(details), "", "PDF invoice attached", "", "If you have any questions, reply to this email.", plainTextFooter()].join("\n"),
  };
}
