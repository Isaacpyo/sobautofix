import "server-only";

import { createHash } from "node:crypto";
import { approvedBookingReplyTo, approvedInternalBookingRecipient, approvedInternalBookingSender } from "@/lib/email/identity";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { renderBookingEmail, renderInternalBookingEmail } from "@/lib/email/templates/bookings";
import { createAdminClient } from "@/lib/supabase/server";
import { formatRegistration } from "@/lib/vehicle/registration-format";
import { bookingCalendarDownloadUrl, buildBookingCalendar, buildGoogleCalendarUrl } from "./calendar";

export type BookingNotificationType = "confirmed" | "rescheduled" | "cancelled";

export type BookingNotificationDetails = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  registration: string;
  vehicleName?: string;
  service: string;
  appointmentStart: string;
  appointmentEnd?: string;
  timezone: string;
  location: string;
  previousAppointmentStart?: string;
  previousAppointmentEnd?: string;
  calendarSequence: number;
  calendarTimestamp: string;
  notes?: string;
};

function appointmentParts(startValue: string, endValue?: string) {
  const start = new Date(startValue);
  const end = endValue ? new Date(endValue) : null;
  const time = (instant: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(instant);
  const date = (instant: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" }).format(instant);
  const durationMinutes = end ? Math.round((end.getTime() - start.getTime()) / 60_000) : null;
  return {
    date: date(start),
    startTime: time(start),
    endTime: end ? `${date(end) === date(start) ? "" : `${date(end)} at `}${time(end)}` : undefined,
    duration: durationMinutes && durationMinutes > 0 ? `${durationMinutes} minutes` : undefined,
  };
}

function previousAppointmentLabel(startValue?: string, endValue?: string) {
  if (!startValue) return undefined;
  const previous = appointmentParts(startValue, endValue);
  return `${previous.date} at ${previous.startTime}${previous.endTime ? `–${previous.endTime}` : ""}`;
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
  const appointment = appointmentParts(booking.appointmentStart, booking.appointmentEnd);
  const vehicle = [formatRegistration(booking.registration), booking.vehicleName].filter(Boolean).join(" · ");
  const calendarDetails = booking.appointmentEnd ? {
    reference: booking.reference,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    service: booking.service,
    vehicle,
    appointmentStart: booking.appointmentStart,
    appointmentEnd: booking.appointmentEnd,
    timezone: booking.timezone,
    location: booking.location,
    sequence: booking.calendarSequence,
    status: type,
    timestamp: booking.calendarTimestamp,
  } : null;
  const calendarUrl = type === "cancelled" ? null : bookingCalendarDownloadUrl(booking.reference);
  const rendered = renderBookingEmail({
    type,
    customerName: booking.customerName,
    reference: booking.reference,
    service: booking.service,
    vehicle,
    date: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    duration: appointment.duration,
    timezone: `${booking.timezone} (UK time)`,
    location: booking.location,
    previousAppointment: previousAppointmentLabel(booking.previousAppointmentStart, booking.previousAppointmentEnd),
    googleCalendarUrl: calendarDetails && type !== "cancelled" ? buildGoogleCalendarUrl(calendarDetails) : undefined,
    calendarUrl: calendarUrl || undefined,
  });
  const internalRendered = renderInternalBookingEmail({
    type,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    notes: booking.notes,
    reference: booking.reference,
    service: booking.service,
    vehicle,
    date: appointment.date,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    duration: appointment.duration,
    timezone: `${booking.timezone} (UK time)`,
    location: booking.location,
  });

  const [customerSent, internalSent] = await Promise.all([
    reserveAndSend(admin, booking, type, key, {
      to: booking.customerEmail,
      subject: subjectFor(type, booking.reference),
      text: rendered.text,
      html: rendered.html,
      replyTo: approvedBookingReplyTo,
      idempotencyKey: `booking-${createHash("sha256").update(key).digest("hex")}`,
      attachments: calendarDetails ? [{ filename: `${booking.reference}.ics`, content: Buffer.from(buildBookingCalendar(calendarDetails), "utf8") }] : undefined,
    }, `${type}_email_failed`),
    reserveAndSend(admin, booking, type, `${key}:internal`, {
      from: approvedInternalBookingSender,
      to: approvedInternalBookingRecipient,
      subject: `${type === "confirmed" ? "New" : type === "rescheduled" ? "Updated" : "Cancelled"} SOB Autofix booking ${booking.reference}`,
      text: internalRendered.text,
      html: internalRendered.html,
      replyTo: booking.customerEmail,
      idempotencyKey: `booking-internal-${createHash("sha256").update(key).digest("hex")}`,
    }, `${type}_internal_email_failed`),
  ]);
  return customerSent && internalSent;
}

type BookingAdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

async function reserveAndSend(admin: BookingAdminClient, booking: BookingNotificationDetails, type: BookingNotificationType, notificationKey: string, message: Parameters<typeof sendTransactionalEmail>[0], failureAction: string) {
  const { error: reservationError } = await admin.from("booking_notification_events").insert({ notification_key: notificationKey, booking_id: booking.id, notification_type: type, status: "pending" });
  if (reservationError?.code === "23505") return true;
  if (reservationError) return false;
  try {
    await sendTransactionalEmail(message);
    await admin.from("booking_notification_events").update({ status: "sent", sent_at: new Date().toISOString(), last_error_code: null }).eq("notification_key", notificationKey);
    return true;
  } catch {
    await Promise.all([
      admin.from("booking_notification_events").update({ status: "failed", last_error_code: "delivery_failed" }).eq("notification_key", notificationKey),
      admin.from("booking_audit_log").insert({ booking_id: booking.id, action: failureAction, actor_type: "system", detail: { channel: notificationKey.endsWith(":internal") ? "internal" : "customer" } }),
    ]);
    return false;
  }
}
