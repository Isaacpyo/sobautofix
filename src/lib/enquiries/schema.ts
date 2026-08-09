import { z } from "zod";
import { enquiryTypes } from "@/types/domain";

const vehicleSchema = z.object({
  registration: z.string().min(2).max(8).regex(/^[A-Z0-9]+$/),
  make: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  derivative: z.string().max(120).optional(),
  year: z.number().int().min(1885).max(new Date().getFullYear() + 1).optional(),
  colour: z.string().max(40).optional(),
  fuelType: z.string().max(40).optional(),
  transmission: z.string().max(40).optional(),
  engineCapacityCc: z.number().int().positive().max(20000).optional(),
  bodyType: z.string().max(60).optional(),
});

export const enquiryRequestSchema = z.object({
  type: z.enum(enquiryTypes),
  contact: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.email().max(254).optional(),
    phone: z.string().trim().min(7).max(30),
    preferredContact: z.enum(["phone", "whatsapp", "email"]),
  }),
  vehicle: vehicleSchema.optional(),
  serviceSlug: z.string().max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().min(10).max(3000),
  locationPostcode: z.string().trim().max(12).optional(),
  driveable: z.boolean().optional(),
  turnstileToken: z.string().min(1),
});

export type EnquiryRequest = z.infer<typeof enquiryRequestSchema>;

export const attachmentRequestSchema = z.object({
  name: z.string().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(8 * 1024 * 1024),
});
