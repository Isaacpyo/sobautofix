import "server-only";

import { approvedEnquiryFallbackReplyTo } from "@/lib/email/identity";
import { sendTransactionalEmail, TransactionalEmailDeliveryError } from "@/lib/email/resend";
import { renderViewingEmail, type ViewingEmailType } from "@/lib/email/templates/diary";
import { getEnquiryReplyAddress } from "@/lib/enquiries/thread-repository";
import { getExchangeSettings } from "@/lib/exchange/settings";
import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { saleVehicleLabel } from "./mapping";
import { getAppointment } from "./repository";
import { formatLondonDateTime } from "./time";

export const CUSTOMER_EMAIL_AUDIT_ACTION = "diary.customer_email";

export type EmailOutcome = { status: "sent" | "failed" | "skipped"; message: string };

export type ViewingEmailAudit = {
  appointmentId: string;
  template: ViewingEmailType;
  status: "sent" | "failed";
  errorCode?: string;
  createdAt: string;
  previousStart?: string | null;
  message?: string | null;
};

/**
 * Emails the customer about their viewing, then records the attempt in
 * notification_attempts (against the linked enquiry, as the enquiry pipeline
 * does) and in the audit log, which is where the Viewings page reads failures
 * from to offer a retry. Never throws for a delivery failure.
 */
export async function sendViewingEmail(staff: StaffContext, appointmentId: string, template: ViewingEmailType, options: { previousStart?: string | null; message?: string | null } = {}): Promise<EmailOutcome> {
  const { appointment } = await getAppointment(staff.client, appointmentId);
  if (!appointment) return { status: "skipped", message: "The appointment could not be found." };
  const customer = appointment.customers;
  if (!customer?.email || customer.anonymised_at) return { status: "skipped", message: "No email was sent because the customer did not give an email address." };

  const settings = await getExchangeSettings();
  const address = [settings.address.building, settings.address.street, settings.address.town, settings.address.city, settings.address.postcode].filter(Boolean).join(", ");
  const vehicle = saleVehicleLabel(appointment.sale_vehicles)?.split(" · ")[0] || appointment.title.replace(/^Viewing:\s*/, "");
  const email = renderViewingEmail({
    type: template,
    businessName: settings.name,
    customerName: customer.name || "there",
    vehicle,
    when: formatLondonDateTime(appointment.starts_at),
    previousWhen: options.previousStart ? formatLondonDateTime(options.previousStart) : undefined,
    address: appointment.location || address,
    contactPhone: settings.phone || undefined,
    message: options.message,
  });

  let status: "sent" | "failed" = "sent";
  let errorCode: string | undefined;
  let providerId: string | null = null;
  try {
    let replyTo = approvedEnquiryFallbackReplyTo;
    if (appointment.enquiry_id) {
      try {
        replyTo = (await getEnquiryReplyAddress(appointment.enquiry_id, "vehicle_sales")) || approvedEnquiryFallbackReplyTo;
      } catch {
        replyTo = approvedEnquiryFallbackReplyTo;
      }
    }
    const result = await sendTransactionalEmail({
      to: customer.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      replyTo,
      // Same appointment, same template, same time: a retry never sends twice.
      idempotencyKey: `diary-${appointment.id}-${template}-${Date.parse(appointment.starts_at)}`,
      tags: [{ name: "category", value: "viewing" }],
    });
    providerId = result.data?.id ?? null;
  } catch (error) {
    status = "failed";
    errorCode = error instanceof TransactionalEmailDeliveryError ? error.code : error instanceof Error ? error.name : "unknown";
  }

  if (appointment.enquiry_id) {
    await staff.client.from("notification_attempts").insert({ enquiry_id: appointment.enquiry_id, recipient_type: "customer", status, provider_id: providerId, error_code: errorCode ?? null });
  }
  try {
    await auditStaffAction(staff, CUSTOMER_EMAIL_AUDIT_ACTION, "diary_appointment", appointment.id, { template, status, errorCode: errorCode ?? null, previousStart: options.previousStart ?? null, message: options.message ?? null });
  } catch {
    // The email outcome is still reported to the person below.
  }
  if (status === "sent") return { status, message: "The customer has been emailed." };
  return { status, message: errorCode === "email_not_configured" ? "The customer could not be emailed because email sending is not set up here. Use Retry email once it is." : "The email to the customer failed. Use Retry email to try again." };
}

/** Latest customer email attempt for each appointment, from the audit log. */
export async function latestViewingEmails(client: StaffContext["client"], appointmentIds: string[]) {
  const latest = new Map<string, ViewingEmailAudit>();
  if (!appointmentIds.length) return latest;
  const { data } = await client
    .from("admin_audit_log")
    .select("entity_id,detail,created_at")
    .eq("action", CUSTOMER_EMAIL_AUDIT_ACTION)
    .eq("entity_type", "diary_appointment")
    .in("entity_id", appointmentIds)
    .order("created_at", { ascending: false })
    .limit(500);
  for (const row of (data || []) as Array<{ entity_id: string; detail: Record<string, unknown> | null; created_at: string }>) {
    if (latest.has(row.entity_id)) continue;
    const detail = row.detail || {};
    const template = detail.template;
    if (template !== "confirmed" && template !== "rescheduled" && template !== "proposed" && template !== "cancelled") continue;
    latest.set(row.entity_id, {
      appointmentId: row.entity_id,
      template,
      status: detail.status === "sent" ? "sent" : "failed",
      errorCode: typeof detail.errorCode === "string" ? detail.errorCode : undefined,
      createdAt: row.created_at,
      previousStart: typeof detail.previousStart === "string" ? detail.previousStart : null,
      message: typeof detail.message === "string" ? detail.message : null,
    });
  }
  return latest;
}
