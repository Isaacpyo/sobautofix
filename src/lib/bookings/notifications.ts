import "server-only";

import { createHash } from "node:crypto";
import { siteConfig } from "@/config/site";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/server";
import { formatRegistration } from "@/lib/vehicle/registration-format";

export type BookingNotificationType = "confirmed" | "rescheduled" | "cancelled";

export type BookingNotificationDetails = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  registration: string;
  vehicleName?: string;
  service: string;
  appointmentStart: string;
  location: string;
};

function appointmentLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function notificationKey(booking: BookingNotificationDetails, type: BookingNotificationType) {
  const appointmentInstant = new Date(booking.appointmentStart).toISOString();
  const version = type === "rescheduled" ? createHash("sha256").update(appointmentInstant).digest("hex").slice(0, 16) : "once";
  return `${booking.reference}:${type}:${version}`;
}

function subjectFor(type: BookingNotificationType, reference: string) {
  if (type === "rescheduled") return `Your SOB Autofix booking ${reference} has been rescheduled`;
  if (type === "cancelled") return `Your SOB Autofix booking ${reference} has been cancelled`;
  return `Your SOB Autofix booking ${reference}`;
}

function openingFor(type: BookingNotificationType, service: string, appointment: string) {
  if (type === "rescheduled") return `Your ${service} appointment has been moved to ${appointment}.`;
  if (type === "cancelled") return `Your ${service} appointment for ${appointment} has been cancelled.`;
  return `Your ${service} appointment is booked for ${appointment}.`;
}

export async function sendBookingNotification(booking: BookingNotificationDetails, type: BookingNotificationType) {
  const admin = createAdminClient();
  if (!admin) return false;
  const key = notificationKey(booking, type);
  const { error: reservationError } = await admin.from("booking_notification_events").insert({
    notification_key: key,
    booking_id: booking.id,
    notification_type: type,
    status: "pending",
  });
  if (reservationError?.code === "23505") return true;
  if (reservationError) return false;

  const appointment = appointmentLabel(booking.appointmentStart);
  const vehicle = [formatRegistration(booking.registration), booking.vehicleName].filter(Boolean).join(" · ");
  const manageUrl = new URL("/manage-booking", siteConfig.siteUrl).toString();
  const text = [
    `Hello ${booking.customerName},`,
    "",
    openingFor(type, booking.service, appointment),
    "",
    `Booking reference: ${booking.reference}`,
    `Vehicle: ${vehicle}`,
    `Service: ${booking.service}`,
    `Appointment: ${appointment}`,
    `Location: ${booking.location}`,
    "",
    `Manage your booking: ${manageUrl}`,
    `Contact SOB Autofix: ${siteConfig.phone} · ${siteConfig.email}`,
    "",
    siteConfig.legalName,
  ].join("\n");

  try {
    await sendTransactionalEmail({
      to: booking.customerEmail,
      subject: subjectFor(type, booking.reference),
      text,
      idempotencyKey: `booking-${createHash("sha256").update(key).digest("hex")}`,
    });
    await admin.from("booking_notification_events").update({ status: "sent", sent_at: new Date().toISOString(), last_error_code: null }).eq("notification_key", key);
    return true;
  } catch {
    await Promise.all([
      admin.from("booking_notification_events").update({ status: "failed", last_error_code: "delivery_failed" }).eq("notification_key", key),
      admin.from("booking_audit_log").insert({ booking_id: booking.id, action: `${type}_email_failed`, actor_type: "system", detail: {} }),
    ]);
    return false;
  }
}
