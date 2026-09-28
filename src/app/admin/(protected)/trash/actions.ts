"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";

const entitySchema = z.enum(["enquiries", "bookings", "invoices", "inventory", "news", "media", "reviews", "offers"]);
const actionSchema = z.enum(["trash", "restore", "delete"]);
const idsSchema = z.array(z.string().uuid()).min(1).max(100);

export type TrashActionResult = { success: boolean; message: string };

export async function manageTrashAction(formData: FormData): Promise<TrashActionResult> {
  const admin = await getAdminUser({ requireMfa: false, allowTrustedDevice: true });
  if (!admin) redirect("/admin/login");
  if (admin.mfaState === "enrollment_required") redirect("/admin/mfa/enroll");
  if (admin.mfaState === "challenge_required") redirect("/admin/mfa?returnTo=%2Fadmin%2Ftrash&stepUp=1");

  const parsed = z.object({
    entity: entitySchema,
    intent: actionSchema,
    ids: idsSchema,
  }).safeParse({
    entity: formData.get("entity"),
    intent: formData.get("intent"),
    ids: [...new Set(formData.getAll("ids").map(String))],
  });
  if (!parsed.success) return { success: false, message: "Choose at least one valid item." };

  const service = createAdminClient();
  if (!service) return { success: false, message: "Trash is temporarily unavailable." };

  let objectPaths: string[] = [];
  if (parsed.data.intent === "delete" && parsed.data.entity === "media") {
    const { data } = await service.from("media_assets").select("object_path").in("id", parsed.data.ids).not("deleted_at", "is", null);
    objectPaths = (data || []).map((item) => item.object_path);
  }
  if (parsed.data.intent === "delete" && parsed.data.entity === "inventory") {
    const { data } = await service.from("sale_vehicle_images").select("object_path").in("sale_vehicle_id", parsed.data.ids);
    objectPaths = (data || []).map((item) => item.object_path);
  }

  const { data, error } = await admin.client.rpc("manage_admin_trash", {
    p_entity: parsed.data.entity,
    p_ids: parsed.data.ids,
    p_action: parsed.data.intent,
  });
  if (error) return { success: false, message: "The selected items could not be updated. They may be protected by linked records." };

  if (parsed.data.intent === "delete" && objectPaths.length) {
    const bucket = parsed.data.entity === "inventory" ? "vehicle-sales" : "public-media";
    await service.storage.from(bucket).remove(objectPaths);
  }

  revalidateTrashPaths(parsed.data.entity);
  const affected = typeof data === "number" ? data : 0;
  if (parsed.data.intent === "delete" && affected < parsed.data.ids.length) {
    return { success: true, message: `${affected} deleted. Protected or non-draft linked records were kept.` };
  }
  const verb = parsed.data.intent === "trash" ? "moved to trash" : parsed.data.intent === "restore" ? "restored" : "deleted permanently";
  return { success: true, message: `${affected} ${affected === 1 ? "item" : "items"} ${verb}.` };
}

function revalidateTrashPaths(entity: z.infer<typeof entitySchema>) {
  const adminPath: Record<z.infer<typeof entitySchema>, string> = {
    enquiries: "/admin/enquiries",
    bookings: "/admin/bookings",
    invoices: "/admin/invoices",
    inventory: "/admin/inventory",
    news: "/admin/news",
    media: "/admin/media",
    reviews: "/admin/reviews",
    offers: "/admin/offers",
  };
  revalidatePath(adminPath[entity]);
  revalidatePath("/admin/trash");
  revalidatePath("/admin", "layout");
  for (const path of ["/", "/news", "/cars-for-sale", "/gallery", "/reviews"]) revalidatePath(path, "layout");
}
