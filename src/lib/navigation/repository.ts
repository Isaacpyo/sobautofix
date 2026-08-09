import "server-only";

import { mainNavigation } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/server";

export type PublicNavigationItem = { label: string; href: string };

export async function getPublicNavigation(): Promise<PublicNavigationItem[]> {
  const admin = createAdminClient();
  if (!admin) return [...mainNavigation];
  const { data } = await admin.from("navigation_items").select("label,href").eq("published", true).is("parent_id", null).order("position");
  return data?.length ? data : [...mainNavigation];
}
