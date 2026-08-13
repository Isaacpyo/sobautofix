import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { emailUrl } from "@/lib/email/brand";

export type BookingCalendarStatus = "confirmed" | "rescheduled" | "cancelled";

export type BookingCalendarDetails = {
  reference: string;
  customerName: string;
  customerEmail: string;
  service: string;
  vehicle: string;
  appointmentStart: string;
  appointmentEnd: string;
  timezone: string;
  location: string;
  sequence: number;
  status: BookingCalendarStatus;
  timestamp: string;
};

function calendarSigningKey() {
  const key = process.env.BOOKING_MANAGEMENT_SECRET?.trim();
  if (key) return key;
  if (process.env.NODE_ENV !== "production") return "local-booking-calendar-only";
  return null;
}

function signCalendarReference(reference: string) {
  const key = calendarSigningKey();
  return key ? createHmac("sha256", key).update(`booking-calendar:${reference}`).digest("base64url") : null;
}

export function bookingCalendarDownloadUrl(reference: string) {
  const signature = signCalendarReference(reference);
  if (!signature) return null;
  return emailUrl(`/api/bookings/calendar/${encodeURIComponent(reference)}?signature=${encodeURIComponent(signature)}`);
}

export function verifyBookingCalendarSignature(reference: string, supplied: string | null) {
  if (!supplied) return false;
  const expected = signCalendarReference(reference);
  if (!expected) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function bookingCalendarUid(reference: string) {
  const safeReference = reference.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return `${safeReference}@sobautofix.com`;
}

function utcCalendarDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid booking calendar date");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeCalendarText(value: string) {
  return value.replaceAll("\\", "\\\\").replace(/\r?\n/g, "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function foldCalendarLine(line: string) {
  const folded: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const character of line) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    const limit = folded.length === 0 ? 75 : 74;
    if (current && currentBytes + characterBytes > limit) {
      folded.push(current);
      current = ` ${character}`;
      currentBytes = 1 + characterBytes;
    } else {
      current += character;
      currentBytes += characterBytes;
    }
  }
  if (current) folded.push(current);
  return folded.join("\r\n");
}

export function buildBookingCalendar(details: BookingCalendarDetails) {
  const cancelled = details.status === "cancelled";
  const manageUrl = emailUrl("/manage-booking");
  const description = [
    "SOB Autofix booking",
    `Reference: ${details.reference}`,
    `Vehicle: ${details.vehicle}`,
    `Service: ${details.service}`,
    "",
    `Manage booking: ${manageUrl}`,
  ].join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SOB Autofix Limited//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${cancelled ? "CANCEL" : "REQUEST"}`,
    `X-WR-TIMEZONE:${escapeCalendarText(details.timezone)}`,
    "BEGIN:VEVENT",
    `UID:${bookingCalendarUid(details.reference)}`,
    `DTSTAMP:${utcCalendarDate(details.timestamp)}`,
    `DTSTART:${utcCalendarDate(details.appointmentStart)}`,
    `DTEND:${utcCalendarDate(details.appointmentEnd)}`,
    `SEQUENCE:${Math.max(0, Math.floor(details.sequence))}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    `SUMMARY:${escapeCalendarText(`${details.service} — SOB Autofix`)}`,
    `LOCATION:${escapeCalendarText(details.location)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    "ORGANIZER;CN=SOB Autofix:mailto:notifications@sobautofix.com",
    `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:${details.customerEmail.replace(/[\r\n]/g, "")}`,
    `URL:${manageUrl}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldCalendarLine).join("\r\n")}\r\n`;
}

export function buildGoogleCalendarUrl(details: Pick<BookingCalendarDetails, "reference" | "service" | "vehicle" | "appointmentStart" | "appointmentEnd" | "timezone" | "location">) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${details.service} — SOB Autofix`,
    dates: `${utcCalendarDate(details.appointmentStart)}/${utcCalendarDate(details.appointmentEnd)}`,
    details: `SOB Autofix booking\nReference: ${details.reference}\nVehicle: ${details.vehicle}\n\nManage booking: ${emailUrl("/manage-booking")}`,
    location: details.location,
    ctz: details.timezone,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
