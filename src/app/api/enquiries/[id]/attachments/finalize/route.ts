import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUploadToken } from "@/lib/enquiries/upload-token";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!verifyUploadToken(request.headers.get("x-upload-token"), id)) return NextResponse.json({ error: "Invalid upload session" }, { status: 403 });
  const parsed = z.object({ attachmentId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid attachment" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Uploads are unavailable" }, { status: 503 });
  const { data: attachment } = await admin.from("enquiry_attachments").select("object_path").eq("id", parsed.data.attachmentId).eq("enquiry_id", id).single();
  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  const { data: files } = await admin.storage.from("enquiry-attachments").list(id, { search: attachment.object_path.split("/").pop() });
  if (!files?.length) return NextResponse.json({ error: "Upload not found" }, { status: 400 });
  await admin.from("enquiry_attachments").update({ finalised: true }).eq("id", parsed.data.attachmentId);
  return NextResponse.json({ success: true });
}
