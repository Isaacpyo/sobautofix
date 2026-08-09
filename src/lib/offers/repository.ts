import "server-only";

import { specialOffer } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/server";

export async function getActiveOffer(id?: string) {
  const admin = createAdminClient();
  if (!admin) return id ? null : specialOffer;
  const now = new Date().toISOString();
  let query = admin.from("offers").select("id,title,description,active,starts_at,ends_at").eq("active", true).or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gte.${now}`);
  if (id) query = query.eq("id", id);
  const { data } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return data || null;
}
