import "server-only";

import { cache } from "react";
import {
  exchangePrivateDefaults,
  exchangePublicDefaults,
  type ExchangePrivateSettings,
  type ExchangePublicSettings,
} from "@/config/exchange";
import { getSiteSettings } from "@/lib/settings/repository";
import { createAdminClient } from "@/lib/supabase/server";

export type ResolvedExchangeSettings = ExchangePublicSettings & {
  legalName: string;
  companyNumber: string;
  address: Awaited<ReturnType<typeof getSiteSettings>>["address"];
  /** The workshop brand, used for "Repairs & Diagnostics" links. */
  workshopName: string;
};

/** Merge stored overrides onto defaults, keeping only known keys of the right type. */
export function mergeSettings<T extends Record<string, unknown>>(defaults: T, stored: unknown): T {
  if (!stored || typeof stored !== "object") return defaults;
  const result: Record<string, unknown> = { ...defaults };
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = (stored as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(fallback)) {
      if (Array.isArray(value)) result[key] = value.filter((item) => typeof item === typeof (fallback[0] ?? "")).map((item) => item);
    } else if (typeof fallback === "object" && fallback !== null) {
      result[key] = mergeSettings(fallback as Record<string, unknown>, value);
    } else if (typeof value === typeof fallback) {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Public settings for the customer app. Contact details fall back to the
 * main SOB Autofix settings so there is one source of truth until staff
 * choose separate sales contact details.
 */
export const getExchangeSettings = cache(async (): Promise<ResolvedExchangeSettings> => {
  const [site, stored] = await Promise.all([getSiteSettings(), readSettingsRow("exchange_settings")]);
  const merged = mergeSettings(exchangePublicDefaults, stored);
  return {
    ...merged,
    phone: merged.phone || site.phone,
    whatsapp: merged.whatsapp || site.whatsapp,
    email: merged.email || site.email,
    legalName: site.legalName,
    companyNumber: site.companyNumber,
    address: site.address,
    workshopName: site.name,
  };
});

/** Private operating settings. Server-only; never pass to client components wholesale. */
export const getExchangePrivateSettings = cache(async (): Promise<ExchangePrivateSettings> => {
  const stored = await readSettingsRow("exchange_private_settings");
  const merged = mergeSettings(exchangePrivateDefaults, stored);
  return {
    ...merged,
    notificationRecipients: merged.notificationRecipients.filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).slice(0, 10),
    viewingLengthMinutes: clamp(merged.viewingLengthMinutes, 15, 240),
    minimumPublishPhotos: clamp(merged.minimumPublishPhotos, 1, 20),
    sellerRetentionMonths: clamp(merged.sellerRetentionMonths, 1, 120),
  };
});

/**
 * Staff who receive exchange notifications. Falls back to the existing
 * enquiry notification address so nothing is silently dropped.
 */
export async function getExchangeNotificationRecipients() {
  const settings = await getExchangePrivateSettings();
  if (settings.notificationRecipients.length) return settings.notificationRecipients;
  const fallback = process.env.ENQUIRY_NOTIFICATION_EMAIL?.trim();
  return fallback ? [fallback] : [];
}

async function readSettingsRow(table: "exchange_settings" | "exchange_private_settings") {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from(table).select("value").eq("id", true).maybeSingle();
  if (error) return null;
  return data?.value ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;
}
