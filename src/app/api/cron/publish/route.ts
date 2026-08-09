import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function publicPath(kind: string, slug: string) {
  if (kind === "service") return `/services/${slug}`;
  if (kind === "diagnostic") return `/diagnostics/${slug}`;
  if (kind === "area") return `/areas/${slug}`;
  if (kind === "article") return `/advice/${slug}`;
  return `/${slug}`;
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const now = new Date().toISOString();
  const { data: due, error } = await admin.from("content_entries").select("id,kind,slug").eq("status", "scheduled").lte("published_at", now);
  if (error) return NextResponse.json({ error: "Scheduled publishing check failed" }, { status: 500 });
  if (!due?.length) return NextResponse.json({ success: true, published: 0 });

  const ids = due.map((entry) => entry.id);
  const { error: updateError } = await admin.from("content_entries").update({ status: "published" }).in("id", ids);
  if (updateError) return NextResponse.json({ error: "Scheduled publishing failed" }, { status: 500 });
  await admin.from("admin_audit_log").insert(due.map((entry) => ({ actor_id: null, action: "scheduled_publish", entity_type: "content", entity_id: entry.id, detail: { kind: entry.kind, slug: entry.slug } })));
  for (const entry of due) revalidatePath(publicPath(entry.kind, entry.slug));
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ success: true, published: due.length });
}
