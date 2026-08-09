import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import type { ServicePrice } from "@/types/domain";

export async function getServicePrice(slug: string): Promise<ServicePrice | null> {
  const admin = createAdminClient(); if (!admin) return null;
  const { data } = await admin.from("service_prices").select("minimum,maximum,label,notes,published").eq("service_slug", slug).eq("published", true).maybeSingle();
  if (!data || (data.minimum == null && data.maximum == null && !data.label)) return null;
  return { minimum: data.minimum ?? undefined, maximum: data.maximum ?? undefined, label: data.label || undefined, notes: data.notes || undefined };
}
