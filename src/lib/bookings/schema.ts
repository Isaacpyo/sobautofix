import { z } from "zod";
import { registrationSchema } from "@/lib/vehicle/registration";

export const bookingLookupSchema = z.object({
  bookingReference: z.string().trim().toUpperCase().regex(/^SOB-\d{6}$/),
  registration: registrationSchema,
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
});

export const bookingAccessSchema = z.object({
  accessToken: z.string().min(20).max(2000),
});

const serviceKeySchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const appointmentSchema = z.string().datetime({ offset: true });
const locationModeSchema = z.enum(["workshop", "mobile"]);

export const bookingSlotRequestSchema = z.object({
  serviceKey: serviceKeySchema,
  locationMode: locationModeSchema,
  start: dateSchema,
  end: dateSchema,
}).superRefine((value, context) => {
  const start = new Date(`${value.start}T00:00:00Z`);
  const end = new Date(`${value.end}T00:00:00Z`);
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0 || days > 14) {
    context.addIssue({ code: "custom", path: ["end"], message: "Choose a date window of no more than 14 days" });
  }
});

export const bookingVehicleSchema = z.object({
  registration: registrationSchema,
  make: z.string().trim().max(80).optional().default(""),
  model: z.string().trim().max(120).optional().default(""),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  fuelType: z.string().trim().max(50).optional(),
  transmission: z.string().trim().max(50).optional(),
  colour: z.string().trim().max(50).optional(),
});

export const bookingCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  phone: z.string().trim().min(7).max(30).regex(/^\+?[0-9 ()-]+$/, "Enter a valid phone number"),
});

export const bookingLocationSchema = z.object({
  mode: locationModeSchema,
  address: z.string().trim().max(300).optional().default(""),
  postcode: z.string().trim().toUpperCase().max(12).optional().default(""),
}).superRefine((value, context) => {
  if (value.mode === "mobile" && value.address.length < 5) {
    context.addIssue({ code: "custom", path: ["address"], message: "Enter the vehicle address" });
  }
  if (value.mode === "mobile" && value.postcode.length < 4) {
    context.addIssue({ code: "custom", path: ["postcode"], message: "Enter a valid postcode" });
  }
});

export const createBookingSchema = z.object({
  vehicle: bookingVehicleSchema,
  serviceKey: serviceKeySchema,
  problemDescription: z.string().trim().min(10).max(2000),
  symptoms: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  conditionalAnswers: z.object({
    mileage: z.string().trim().max(20).optional(),
    warningLight: z.string().trim().max(120).optional(),
    issueTiming: z.string().trim().max(300).optional(),
    vehicleAccessible: z.string().trim().max(120).optional(),
  }).default({}),
  location: bookingLocationSchema,
  customer: bookingCustomerSchema,
  appointmentStart: appointmentSchema,
  idempotencyKey: z.string().uuid(),
});

export const bookingRescheduleSlotsSchema = z.object({
  accessToken: z.string().min(20).max(2000),
  start: dateSchema,
  end: dateSchema,
}).superRefine((value, context) => {
  const days = (new Date(`${value.end}T00:00:00Z`).getTime() - new Date(`${value.start}T00:00:00Z`).getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days <= 0 || days > 14) {
    context.addIssue({ code: "custom", path: ["end"], message: "Choose a date window of no more than 14 days" });
  }
});

export const bookingRescheduleSchema = z.object({
  accessToken: z.string().min(20).max(2000),
  appointmentStart: appointmentSchema,
});

export type BookingLookupInput = z.infer<typeof bookingLookupSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
