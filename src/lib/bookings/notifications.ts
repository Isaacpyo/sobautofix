import "server-only";

import { createHash } from "node:crypto";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { renderBookingEmail } from "@/lib/email/templates/bookings";
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

function appointmentParts(value: string) {
  const instant = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" }).format(instant),
    time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(instant),
  };
}

export function bookingNotificationKey(booking: BookingNotificationDetails, type: BookingNotificationType) {
  const appointmentInstant = new Date(booking.appointmentStart).toISOString();
  const version = type === "rescheduled" ? createHash("sha256").update(appointmentInstant).digest("hex").slice(0, 16) : "once";
  return `${booking.reference}:${type}:${version}`;
}

function subjectFor(type: BookingNotificationType, reference: string) {
  if (type === "rescheduled") return `Your SOB Autofix booking ${reference} has been rescheduled`;
  if (type === "cancelled") return `Your SOB Autofix booking ${reference} has been cancelled`;
  return `Your SOB Autofix booking ${reference}`;
}

export async function sendBookingNotification(booking: BookingNotificationDetails, type: BookingNotificationType) {
  const admin = createAdminClient();
  if (!admin) return false;
  const key = bookingNotificationKey(booking, type);
  const { error: reservationError } = await admin.from("booking_notification_events").insert({
    notification_key: key,
    booking_id: booking.id,
    notification_type: type,
    status: "pending",
  });
  if (reservationError?.code === "23505") return true;
  if (reservationError) return false;

  const appointment = appointmentParts(booking.appointmentStart);
  const rendered = renderBookingEmail({
    type,
    customerName: booking.customerName,
    reference: booking.reference,
    service: booking.service,
    vehicle: [formatRegistration(booking.registration), booking.vehicleName].filter(Boolean).join(" · "),
    date: appointment.date,
    time: appointment.time,
    location: booking.location,
  });

  try {
    await sendTransactionalEmail({
      to: booking.customerEmail,
      subject: subjectFor(type, booking.reference),
      text: rendered.text,
      html: rendered.html,
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
