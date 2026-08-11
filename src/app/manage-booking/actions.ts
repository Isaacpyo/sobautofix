"use server";

import { headers } from "next/headers";
import { createBookingAccessToken, verifyBookingAccessToken } from "@/lib/bookings/access-token";
import {
  beginBookingReschedule,
  cancelBooking,
  findBooking,
  getBookingRescheduleSlots,
  rescheduleBooking,
} from "@/lib/bookings/repository";
import {
  bookingAccessSchema,
  bookingLookupSchema,
  bookingRescheduleSchema,
  bookingRescheduleSlotsSchema,
} from "@/lib/bookings/schema";
import type { BookingLookupState } from "@/lib/bookings/types";
import { consumeRateLimit } from "@/lib/rate-limit";

const genericLookupFailure = "We couldn't find a booking matching those details. Please check the information and try again.";
const expiredSessionMessage = "Your secure booking session has expired. Find your booking again.";
const ineligibleMessage = "This booking can no longer be changed online.";
const maximumSlotWindowDays = 7;

async function requesterIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
}

function verifiedBookingAccess(accessToken: unknown) {
  const parsed = bookingAccessSchema.safeParse({ accessToken });
  return parsed.success ? verifyBookingAccessToken(parsed.data.accessToken) : null;
}

function slotWindowDays(start: string, end: string) {
  return (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000;
}

function safeTimeZone(value: unknown) {
  if (typeof value !== "string") return "Europe/London";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "Europe/London";
  }
}

function safeSlots(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const slot = candidate as Record<string, unknown>;
    if (typeof slot.start !== "string" || Number.isNaN(new Date(slot.start).getTime())) return [];
    const end = typeof slot.end === "string" && !Number.isNaN(new Date(slot.end).getTime()) ? slot.end : undefined;
    return [{ start: slot.start, ...(end ? { end } : {}) }];
  }).slice(0, 250);
}

function operationErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

export async function lookupBookingAction(_previousState: BookingLookupState, formData: FormData): Promise<BookingLookupState> {
  const ip = await requesterIp();
  if (!(await consumeRateLimit(ip, "booking_lookup_ip", 5, 600))) return { status: "error", message: "Too many attempts. Please wait before trying again." };
  const parsed = bookingLookupSchema.safeParse({
    bookingReference: formData.get("bookingReference"),
    registration: formData.get("registration"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { status: "error", message: genericLookupFailure };
  const compoundIdentifier = `${ip}:${parsed.data.bookingReference}:${parsed.data.registration}:${parsed.data.email}`;
  if (!(await consumeRateLimit(compoundIdentifier, "booking_lookup_details", 5, 900))) return { status: "error", message: "Too many attempts. Please wait before trying again." };
  try {
    const result = await findBooking(parsed.data);
    if (!result) return { status: "error", message: genericLookupFailure };
    return { status: "found", booking: result.booking, accessToken: createBookingAccessToken(result.id) };
  } catch {
    return { status: "error", message: genericLookupFailure };
  }
}

export async function beginRescheduleAction(accessToken: string) {
  const access = verifiedBookingAccess(accessToken);
  if (!access) return { success: false as const, message: expiredSessionMessage };
  const ip = await requesterIp();
  if (!(await consumeRateLimit(`${ip}:${access.bookingId}`, "booking_reschedule_begin", 10, 600))) {
    return { success: false as const, message: "Too many attempts. Please wait before trying again." };
  }
  try {
    const eligible = await beginBookingReschedule(access.bookingId);
    return eligible
      ? { success: true as const }
      : { success: false as const, message: "This booking cannot be rescheduled online." };
  } catch {
    return { success: false as const, message: "We couldn't start rescheduling just now. Please try again." };
  }
}

export async function getRescheduleSlotsAction(accessToken: string, start: string, end: string) {
  const parsed = bookingRescheduleSlotsSchema.safeParse({ accessToken, start, end });
  const access = parsed.success ? verifiedBookingAccess(parsed.data.accessToken) : verifiedBookingAccess(accessToken);
  if (!access) return { success: false as const, message: expiredSessionMessage };
  if (!parsed.success || slotWindowDays(parsed.data.start, parsed.data.end) > maximumSlotWindowDays) {
    return { success: false as const, message: "Choose a valid date range of no more than seven days." };
  }
  const ip = await requesterIp();
  if (!(await consumeRateLimit(`${ip}:${access.bookingId}`, "booking_reschedule_slots", 30, 600))) {
    return { success: false as const, message: "Too many availability checks. Please wait a moment before trying again." };
  }
  try {
    const result = await getBookingRescheduleSlots(access.bookingId, parsed.data.start, parsed.data.end);
    if (!result) return { success: false as const, message: "This booking cannot be rescheduled online." };
    return {
      success: true as const,
      slots: safeSlots(result.slots),
      timeZone: safeTimeZone(result.timeZone),
    };
  } catch {
    return { success: false as const, message: "We couldn't load appointment times just now. Please try again." };
  }
}

export async function rescheduleBookingAction(accessToken: string, appointmentStart: string) {
  const parsed = bookingRescheduleSchema.safeParse({ accessToken, appointmentStart });
  const access = parsed.success ? verifiedBookingAccess(parsed.data.accessToken) : verifiedBookingAccess(accessToken);
  if (!access) return { success: false as const, message: expiredSessionMessage };
  if (!parsed.success) return { success: false as const, message: "Choose a valid appointment time." };
  const ip = await requesterIp();
  if (!(await consumeRateLimit(`${ip}:${access.bookingId}`, "booking_reschedule", 3, 600))) {
    return { success: false as const, message: "Too many rescheduling attempts. Please wait before trying again." };
  }
  try {
    const result = await rescheduleBooking(access.bookingId, parsed.data.appointmentStart);
    if (result.outcome === "rescheduled") {
      return { success: true as const, message: "Your appointment has been rescheduled.", booking: result.booking };
    }
    return {
      success: false as const,
      message: result.booking?.modificationMessage || ineligibleMessage,
      booking: result.booking,
    };
  } catch (error) {
    const code = operationErrorCode(error);
    if (code === "slot_unavailable" || code === "invalid_request") {
      return { success: false as const, message: "That appointment time is no longer available. Please choose another time." };
    }
    return { success: false as const, message: "We couldn't reschedule this appointment just now. Please check availability and try again." };
  }
}

export async function cancelBookingAction(accessToken: string) {
  const access = verifiedBookingAccess(accessToken);
  if (!access) return { success: false as const, message: expiredSessionMessage };
  const ip = await requesterIp();
  if (!(await consumeRateLimit(`${ip}:${access.bookingId}`, "booking_cancel", 3, 600))) {
    return { success: false as const, message: "Too many attempts. Please wait before trying again." };
  }
  try {
    const result = await cancelBooking(access.bookingId);
    if (result.outcome === "cancelled") return { success: true as const, message: "Your booking has been cancelled.", booking: result.booking };
    if (result.outcome === "ineligible") {
      return {
        success: false as const,
        message: result.booking.modificationMessage || ineligibleMessage,
        booking: result.booking,
      };
    }
    return { success: false as const, message: "We couldn't find that booking. Please find it again." };
  } catch {
    return { success: false as const, message: "We couldn't cancel this booking online. Please contact SOB Autofix for help." };
  }
}
