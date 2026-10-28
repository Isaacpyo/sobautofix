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

const vehicleEnquiryFields = {
  intent: z.enum(vehicleEnquiryIntents),
  ...contactFields,
  preferredDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((value) => value || undefined),
  preferredTime: z.union([z.literal(""), z.enum(viewingSlots)]).optional().transform((value) => value || undefined),
  alternativeDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((value) => value || undefined),
  alternativeTime: z.union([z.literal(""), z.enum(viewingSlots)]).optional().transform((value) => value || undefined),
  message: z.string().trim().max(2000, "Use 2,000 characters or fewer").optional().transform((value) => value || undefined),
  privacyAccepted: z.literal(true, { message: "Please confirm you have read the privacy notice" }),
};

type VehicleEnquiryShape = { intent: VehicleEnquiryIntent; preferredContact: string; email?: string; preferredDate?: string; preferredTime?: string; alternativeDate?: string; alternativeTime?: string; message?: string };

function refineVehicleEnquiry(value: VehicleEnquiryShape, context: z.RefinementCtx) {
  emailRequiredForEmailContact(value, context);
  if (value.intent === "viewing" && !value.preferredDate) context.addIssue({ code: "custom", path: ["preferredDate"], message: "Choose a preferred date" });
  if (value.intent === "viewing" && !value.preferredTime) context.addIssue({ code: "custom", path: ["preferredTime"], message: "Choose a preferred time" });
  if (value.intent === "question" && !value.message) context.addIssue({ code: "custom", path: ["message"], message: "Tell us what you would like to know" });
  if (value.intent === "viewing" && Boolean(value.alternativeDate) !== Boolean(value.alternativeTime)) {
    context.addIssue({ code: "custom", path: [value.alternativeDate ? "alternativeTime" : "alternativeDate"], message: "Choose both a date and a time for the alternative, or leave both empty" });
  }
}

/** What the visitor fills in. */
export const vehicleEnquiryFormSchema = z.object(vehicleEnquiryFields).superRefine(refineVehicleEnquiry);

/** What the API accepts: the form plus the vehicle, an idempotency key and the security token. */
export const vehicleEnquiryRequestSchema = z.object({
  ...vehicleEnquiryFields,
  idempotencyKey: z.uuid(),
  vehicleId: z.uuid(),
  turnstileToken: z.string().max(4096).optional(),
}).superRefine(refineVehicleEnquiry);

export type VehicleEnquiryFormInput = z.input<typeof vehicleEnquiryFormSchema>;
export type VehicleEnquiryRequest = z.infer<typeof vehicleEnquiryRequestSchema>;

export const runningStatusValues = ["runs_and_drives", "runs_not_driveable", "does_not_run", "not_sure"] as const;
export const motStatusValues = ["valid", "expired", "not_sure"] as const;
export const serviceHistoryValues = ["full", "partial", "none", "not_sure"] as const;
export const outstandingFinanceValues = ["yes", "no", "not_sure"] as const;

const currentYear = new Date().getFullYear();
/** "41,250" -> "41250"; "" -> undefined so an empty number field fails with its own message instead of becoming 0. */
function emptyToUndefined(value: unknown) {
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s]/g, "");
    return cleaned === "" ? undefined : cleaned;
  }
  return value ?? undefined;
}
const optionalText = (max: number) => z.string().trim().max(max, `Use ${max.toLocaleString("en-GB")} characters or fewer`).optional().transform((value) => value || undefined);

export const sellerVehicleSchema = z.object({
  registration: z.string().trim().transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "")).pipe(z.string().regex(/^[A-Z0-9]{2,8}$/, "Enter the registration as shown on the number plate")),
  lookupSource: z.enum(["lookup", "manual"]),
  make: z.string().trim().min(1, "Enter the make").max(60),
  model: z.string().trim().min(1, "Enter the model").max(80),
  derivative: optionalText(120),
  year: z.preprocess(emptyToUndefined, z.coerce.number({ message: "Enter the year" }).int("Enter the year").min(1950, "Enter a year after 1950").max(currentYear + 1, "Check the year")),
  mileage: z.preprocess(emptyToUndefined, z.coerce.number({ message: "Enter the mileage" }).int("Enter whole miles").min(0, "Enter the mileage").max(999_999, "Check the mileage")),
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

/** Everything the visitor fills in across the five steps. */
export const sellerFormSchema = z.object({
  vehicle: sellerVehicleSchema,
  condition: sellerConditionSchema,
  contact: sellerContactSchema,
  privacyAccepted: z.literal(true, { message: "Please confirm you have read how we use your information" }),
});

export type SellerFormInput = z.input<typeof sellerFormSchema>;
export type SellerFormOutput = z.output<typeof sellerFormSchema>;

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
