"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  cancelBooking,
  getBookingRescheduleSlots,
  rescheduleBooking,
} from "@/lib/bookings/repository";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Enter a valid date");

const dateWindowSchema = z.object({
  bookingId: uuidSchema,
  start: dateOnlySchema,
  end: dateOnlySchema,
}).superRefine((value, context) => {
  const start = Date.parse(`${value.start}T00:00:00Z`);
  const end = Date.parse(`${value.end}T00:00:00Z`);
  const days = (end - start) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0 || days > 14) {
    context.addIssue({
      code: "custom",
      path: ["end"],
      message: "Choose a date window of no more than 14 days",
    });
  }
});

const appointmentSchema = z.object({
  bookingId: uuidSchema,
  appointmentStart: z.string().datetime({ offset: true }).refine(
    (value) => Date.parse(value) > Date.now(),
    "Choose a future appointment",
  ),
});

const serviceMappingSchema = z.object({
  id: uuidSchema,
  providerEventTypeId: z.preprocess(
    (value) => value === "" || value == null ? null : value,
    z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  ),
  onlineBookingEnabled: z.boolean(),
  locationMode: z.enum(["workshop", "mobile", "both"]),
}).refine(
  (value) => !value.onlineBookingEnabled || value.providerEventTypeId !== null,
  { path: ["providerEventTypeId"], message: "Add a valid event type ID before enabling online booking" },
);

type SafeActionResult = {
  success: boolean;
  message: string;
};

async function getVerifiedAdmin() {
  const admin = await getAdminUser({ requireMfa: false });
  if (admin?.mfaRequired && !admin.mfaVerified) redirect("/admin/mfa?returnTo=%2Fadmin%2Fbookings&stepUp=1");
  return admin;
}

export async function getAdminBookingSlotsAction(
  bookingId: string,
  start: string,
  end: string,
): Promise<SafeActionResult & { slots?: Array<{ start: string; end?: string }> }> {
  const admin = await getVerifiedAdmin();
  if (!admin) return { success: false, message: "Your admin session has expired. Refresh and sign in again." };

  const parsed = dateWindowSchema.safeParse({ bookingId, start, end });
  if (!parsed.success) return { success: false, message: "Choose a valid date range of up to 14 days." };

  try {
    const result = await getBookingRescheduleSlots(parsed.data.bookingId, parsed.data.start, parsed.data.end);
    if (!result) return { success: false, message: "This booking cannot be rescheduled." };
    const slots = result.slots
      .filter((slot) => Number.isFinite(Date.parse(slot.start)))
      .slice(0, 200)
      .map((slot) => ({
        start: new Date(slot.start).toISOString(),
        ...(slot.end && Number.isFinite(Date.parse(slot.end)) ? { end: new Date(slot.end).toISOString() } : {}),
      }));
    return {
      success: true,
      message: slots.length ? "Available appointment times loaded." : "No appointment times are available in this date range.",
      slots,
    };
  } catch {
    return { success: false, message: "Appointment availability is temporarily unavailable. Please try again." };
  }
}

export async function rescheduleAdminBookingAction(
  bookingId: string,
  appointmentStart: string,
): Promise<SafeActionResult> {
  const admin = await getVerifiedAdmin();
  if (!admin) return { success: false, message: "Your admin session has expired. Refresh and sign in again." };

  const parsed = appointmentSchema.safeParse({ bookingId, appointmentStart });
  if (!parsed.success) return { success: false, message: "Choose a valid future appointment time." };

  try {
    const result = await rescheduleBooking(parsed.data.bookingId, parsed.data.appointmentStart, "admin");
    if (result.outcome !== "rescheduled") {
      return { success: false, message: "This booking can no longer be rescheduled." };
    }
    revalidateBookingPaths(parsed.data.bookingId);
    return { success: true, message: "The booking has been rescheduled and the customer update has been requested." };
  } catch {
    return { success: false, message: "The booking could not be rescheduled. Reload the available times and try again." };
  }
}

export async function cancelAdminBookingAction(bookingId: string): Promise<SafeActionResult> {
  const admin = await getVerifiedAdmin();
  if (!admin) return { success: false, message: "Your admin session has expired. Refresh and sign in again." };

  const parsed = uuidSchema.safeParse(bookingId);
  if (!parsed.success) return { success: false, message: "This booking could not be found." };

  try {
    const result = await cancelBooking(parsed.data, "admin");
    if (result.outcome === "not_found") return { success: false, message: "This booking could not be found." };
    if (result.outcome !== "cancelled") return { success: false, message: "This booking can no longer be cancelled." };
    revalidateBookingPaths(parsed.data);
    return { success: true, message: "The booking has been cancelled and the customer update has been requested." };
  } catch {
    return { success: false, message: "The booking could not be cancelled. Please try again." };
  }
}

export async function saveBookingServiceMappingAction(
  _previousState: SafeActionResult,
  formData: FormData,
): Promise<SafeActionResult> {
  const admin = await getVerifiedAdmin();
  if (!admin) return { success: false, message: "Your admin session has expired. Refresh and sign in again." };

  const parsed = serviceMappingSchema.safeParse({
    id: formData.get("id"),
    providerEventTypeId: formData.get("providerEventTypeId"),
    onlineBookingEnabled: formData.get("onlineBookingEnabled") === "on",
    locationMode: formData.get("locationMode"),
  });
  if (!parsed.success) {
    const eventTypeIssue = parsed.error.issues.some((issue) => issue.path.includes("providerEventTypeId"));
    return {
      success: false,
      message: eventTypeIssue
        ? "Add a positive whole-number event type ID before enabling online booking."
        : "Check the service mapping and try again.",
    };
  }

  const client = createAdminClient();
  if (!client) return { success: false, message: "Booking configuration is temporarily unavailable." };

  const { data, error } = await client
    .from("booking_service_types")
    .update({
      provider_event_type_id: parsed.data.providerEventTypeId,
      online_booking_enabled: parsed.data.onlineBookingEnabled,
      location_mode: parsed.data.locationMode,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { success: false, message: "The service mapping could not be saved." };

  revalidatePath("/admin/bookings/services");
  revalidatePath("/book");
  const { error: auditError } = await client.from("admin_audit_log").insert({
    actor_id: admin.user.id,
    action: "update",
    entity_type: "booking_service_mapping",
    entity_id: parsed.data.id,
    detail: {
      onlineBookingEnabled: parsed.data.onlineBookingEnabled,
      locationMode: parsed.data.locationMode,
    },
  });
  if (auditError) {
    return { success: true, message: "The mapping was saved, but its audit entry could not be recorded." };
  }
  return { success: true, message: "Service mapping saved." };
}

function revalidateBookingPaths(bookingId: string) {
  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
}
