import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { attachmentRequestSchema } from "@/lib/enquiries/schema";
import { verifyUploadToken } from "@/lib/enquiries/upload-token";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!verifyUploadToken(request.headers.get("x-upload-token"), id)) return NextResponse.json({ error: "Invalid upload session" }, { status: 403 });
  const parsed = attachmentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unsupported attachment" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Uploads are unavailable" }, { status: 503 });

  const { count } = await admin.from("enquiry_attachments").select("id", { count: "exact", head: true }).eq("enquiry_id", id);
  if ((count || 0) >= 5) return NextResponse.json({ error: "Attachment limit reached" }, { status: 400 });
  const extension = parsed.data.contentType === "image/jpeg" ? "jpg" : parsed.data.contentType.split("/")[1];
  const objectPath = `${id}/${randomUUID()}.${extension}`;
  const attachmentId = randomUUID();
  const { error: insertError } = await admin.from("enquiry_attachments").insert({ id: attachmentId, enquiry_id: id, object_path: objectPath, file_name: parsed.data.name, content_type: parsed.data.contentType, size_bytes: parsed.data.size });
  if (insertError) return NextResponse.json({ error: "Could not prepare upload" }, { status: 400 });
  const { data, error } = await admin.storage.from("enquiry-attachments").createSignedUploadUrl(objectPath);
  if (error) return NextResponse.json({ error: "Could not prepare upload" }, { status: 503 });
  return NextResponse.json({ path: data.path, token: data.token, attachmentId });
}
