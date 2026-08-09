import "server-only";

import { siteConfig } from "@/config/site";
import type { SiteSettings } from "@/config/settings";
import { createAdminClient } from "@/lib/supabase/server";

export async function getSiteSettings(): Promise<SiteSettings> {
  const admin = createAdminClient();
  if (!admin) return siteConfig;
  const { data } = await admin.from("site_settings").select("value").eq("id", true).maybeSingle();
  if (!data?.value || typeof data.value !== "object") return siteConfig;
  const override = data.value as Partial<SiteSettings>;
  return {
    ...siteConfig,
    ...override,
    address: { ...siteConfig.address, ...(override.address || {}) },
    openingHours: { ...siteConfig.openingHours, ...(override.openingHours || {}) },
  } as SiteSettings;
}
