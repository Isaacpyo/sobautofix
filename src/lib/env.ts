import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CALENDLY_URL: z.string().url().optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_TAWK_PROPERTY_ID: z.string().optional(),
  NEXT_PUBLIC_TAWK_WIDGET_ID: z.string().optional(),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  NEXT_PUBLIC_CALENDLY_URL: process.env.NEXT_PUBLIC_CALENDLY_URL || undefined,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || undefined,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
  NEXT_PUBLIC_TAWK_PROPERTY_ID: process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID || undefined,
  NEXT_PUBLIC_TAWK_WIDGET_ID: process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || undefined,
});

export const requiredProductionVariables = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DVLA_API_KEY",
  "NEXT_PUBLIC_CALENDLY_URL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "ENQUIRY_NOTIFICATION_EMAIL",
  "GOOGLE_PLACES_API_KEY",
  "GOOGLE_PLACE_ID",
  "NEXT_PUBLIC_GOOGLE_MAPS_URL",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_GA_MEASUREMENT_ID",
  "SENTRY_DSN",
  "NEXT_PUBLIC_TAWK_PROPERTY_ID",
  "NEXT_PUBLIC_TAWK_WIDGET_ID",
  "GOOGLE_SEARCH_CONSOLE_VERIFICATION",
  "CRON_SECRET",
] as const;

export function getEnvironmentReadiness() {
  const missing: string[] = requiredProductionVariables.filter((name) => !process.env[name]);
  if (process.env.LEGAL_COPY_APPROVED !== "true") missing.push("LEGAL_COPY_APPROVED");
  if (process.env.COOKIE_CONFIGURATION_APPROVED !== "true") missing.push("COOKIE_CONFIGURATION_APPROVED");
  return { ready: missing.length === 0, missing };
}
