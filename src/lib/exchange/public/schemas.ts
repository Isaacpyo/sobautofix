// Request schemas for the SOB Auto Exchange public APIs. Shared by the forms
// (client validation) and the route handlers (authoritative validation).

import { z } from "zod";
import { viewingSlots } from "./viewing-time";

const phonePattern = /^[+()0-9\s-]{7,30}$/;

export const preferredContactValues = ["phone", "whatsapp", "email"] as const;

const contactFields = {
  name: z.string().trim().min(2, "Enter your name").max(100, "Use 100 characters or fewer"),
  phone: z.string().trim().regex(phonePattern, "Enter a phone number we can call").refine((value) => value.replace(/\D/g, "").length >= 7, "Enter a phone number we can call"),
  email: z.union([z.literal(""), z.email("Enter a valid email address").max(200)]).optional().transform((value) => value || undefined),
  preferredContact: z.enum(preferredContactValues, { message: "Choose how we should contact you" }),
};

function emailRequiredForEmailContact(value: { preferredContact: string; email?: string }, context: z.RefinementCtx) {
  if (value.preferredContact === "email" && !value.email) {
    context.addIssue({ code: "custom", path: ["email"], message: "Add an email address, or choose phone or WhatsApp" });
  }
}

export const vehicleEnquiryIntents = ["viewing", "question"] as const;
export type VehicleEnquiryIntent = (typeof vehicleEnquiryIntents)[number];

export const vehicleEnquiryRequestSchema = z.object({
  idempotencyKey: z.uuid(),
  vehicleId: z.uuid(),
  intent: z.enum(vehicleEnquiryIntents),
  ...contactFields,
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferredTime: z.enum(viewingSlots).optional(),
  alternativeDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((value) => value || undefined),
  alternativeTime: z.union([z.literal(""), z.enum(viewingSlots)]).optional().transform((value) => value || undefined),
  message: z.string().trim().max(2000, "Use 2,000 characters or fewer").optional().transform((value) => value || undefined),
  privacyAccepted: z.literal(true, { message: "Please confirm you have read the privacy notice" }),
  turnstileToken: z.string().max(4096).optional(),
}).superRefine((value, context) => {
  emailRequiredForEmailContact(value, context);
  if (value.intent === "viewing" && (!value.preferredDate || !value.preferredTime)) {
    context.addIssue({ code: "custom", path: ["preferredDate"], message: "Choose a preferred date and time" });
  }
  if (value.intent === "question" && !value.message) {
    context.addIssue({ code: "custom", path: ["message"], message: "Tell us what you would like to know" });
  }
  if (Boolean(value.alternativeDate) !== Boolean(value.alternativeTime)) {
    context.addIssue({ code: "custom", path: ["alternativeTime"], message: "Choose both a date and a time for the alternative, or leave both empty" });
  }
});

export type VehicleEnquiryRequest = z.infer<typeof vehicleEnquiryRequestSchema>;

export const runningStatusValues = ["runs_and_drives", "runs_not_driveable", "does_not_run", "not_sure"] as const;
export const motStatusValues = ["valid", "expired", "not_sure"] as const;
export const serviceHistoryValues = ["full", "partial", "none", "not_sure"] as const;
export const outstandingFinanceValues = ["yes", "no", "not_sure"] as const;

const currentYear = new Date().getFullYear();
const optionalText = (max: number) => z.string().trim().max(max, `Use ${max.toLocaleString("en-GB")} characters or fewer`).optional().transform((value) => value || undefined);

export const sellerVehicleSchema = z.object({
  registration: z.string().trim().transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "")).pipe(z.string().regex(/^[A-Z0-9]{2,8}$/, "Enter the registration as shown on the number plate")),
  lookupSource: z.enum(["lookup", "manual"]),
  make: z.string().trim().min(1, "Enter the make").max(60),
  model: z.string().trim().min(1, "Enter the model").max(80),
  derivative: optionalText(120),
  year: z.coerce.number({ message: "Enter the year" }).int("Enter the year").min(1950, "Enter a year after 1950").max(currentYear + 1, "Check the year"),
  mileage: z.coerce.number({ message: "Enter the mileage" }).int("Enter whole miles").min(0, "Enter the mileage").max(999_999, "Check the mileage"),
  fuelType: optionalText(40),
  transmission: optionalText(40),
  colour: optionalText(40),
});

export const sellerConditionSchema = z.object({
  runningStatus: z.enum(runningStatusValues, { message: "Choose an option" }),
  knownFaults: optionalText(2000),
  damage: optionalText(2000),
  motStatus: z.enum(motStatusValues, { message: "Choose an option" }),
  motExpiry: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")]).optional().transform((value) => value || undefined),
  serviceHistory: z.enum(serviceHistoryValues, { message: "Choose an option" }),
  outstandingFinance: z.enum(outstandingFinanceValues, { message: "Choose an option" }),
});

const sellerContactBase = z.object({
  ...contactFields,
  postcode: z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/, "Enter a UK postcode"),
  marketingConsent: z.boolean().default(false),
});

export const sellerContactSchema = sellerContactBase.superRefine(emailRequiredForEmailContact);

export const sellerSubmissionRequestSchema = z.object({
  idempotencyKey: z.uuid(),
  interestedVehicleId: z.uuid().optional(),
  vehicle: sellerVehicleSchema,
  condition: sellerConditionSchema,
  contact: sellerContactSchema,
  privacyAccepted: z.literal(true, { message: "Please confirm you have read how we use your information" }),
  photoCount: z.number().int().min(0).max(12).default(0),
  turnstileToken: z.string().max(4096).optional(),
});

export type SellerSubmissionRequest = z.infer<typeof sellerSubmissionRequestSchema>;

export const sellerPhotoCategories = ["exterior", "interior", "dashboard", "damage", "other"] as const;
export type SellerPhotoCategory = (typeof sellerPhotoCategories)[number];

export const SELLER_PHOTO_LIMIT = 12;
export const SELLER_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const sellerPhotoTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const sellerPhotoSignSchema = z.object({
  contentType: z.enum(sellerPhotoTypes),
  size: z.number().int().positive().max(SELLER_PHOTO_MAX_BYTES),
  category: z.enum(sellerPhotoCategories).default("other"),
});

export const sellerPhotoFinalizeSchema = z.object({ photoId: z.uuid() });
