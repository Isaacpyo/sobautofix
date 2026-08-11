"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertCustomerFacingContent } from "@/lib/content-guard";
import { contentEntrySchema } from "@/lib/content/schema";
import { attachmentRequestSchema } from "@/lib/enquiries/schema";
import { retryEnquiryNotifications } from "@/lib/enquiries/repository";
import { addInternalNote, linkUnmatchedInboundEmail, markEnquiryThreadRead, sendEnquiryReply, type ReplyState } from "@/lib/enquiries/thread-repository";
import { createAdminClient, getAdminUser } from "@/lib/supabase/server";
import { diagnostics, services } from "@/config/site";
import { articleCategories } from "@/lib/news/article";
import { normalizeRegistration } from "@/lib/vehicle/registration-format";

async function requireAdmin() {
  const auth = await getAdminUser();
  const client = createAdminClient();
  if (!auth || !client) throw new Error("Unauthorised");
  return { auth, client };
}

async function audit(client: NonNullable<ReturnType<typeof createAdminClient>>, actorId: string, action: string, entityType: string, entityId: string, detail: Record<string, unknown> = {}) {
  const { error } = await client.from("admin_audit_log").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, detail });
  if (error) throw new Error("The change was saved, but its required audit entry could not be recorded.");
}

export async function saveContent(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const id = String(formData.get("id") || "");
  const sections = JSON.parse(String(formData.get("sections") || "[]")) as unknown;
  const metadata = JSON.parse(String(formData.get("metadata") || "{}")) as unknown;
  const articleIntent = String(formData.get("articleIntent") || "");
  const requestedStatus = articleIntent === "draft" || articleIntent === "published" || articleIntent === "archived"
    ? articleIntent
    : formData.get("status");
  const publicationValue = String(formData.get("publishedAt") || "");
  const parsed = contentEntrySchema.parse({
    id: id || undefined,
    kind: formData.get("kind"), slug: formData.get("slug"), title: formData.get("title"), excerpt: formData.get("excerpt"),
    sections, metadata, seoTitle: formData.get("seoTitle"), seoDescription: formData.get("seoDescription"), status: requestedStatus,
    publishedAt: publicationValue ? new Date(publicationValue).toISOString() : undefined,
  });
  if (parsed.kind === "article") {
    const articleMetadata = z.object({
      category: z.enum(articleCategories),
      author: z.string().trim().min(2).max(100),
      coverImageId: z.string().uuid().optional(),
      featured: z.boolean().optional(),
    }).parse(parsed.metadata);
    if ((parsed.status === "published" || parsed.status === "scheduled") && articleMetadata.coverImageId) {
      const { data: cover } = await client.from("media_assets").select("published,alt_text").eq("id", articleMetadata.coverImageId).maybeSingle();
      if (!cover?.published) throw new Error("Publish the selected cover image in the Media Library before publishing this article.");
      if (!cover.alt_text || cover.alt_text.trim().length < 5) throw new Error("The selected cover image needs meaningful alt text before this article can be published.");
    }
  }
  if (parsed.status === "published" || parsed.status === "scheduled") await validateInternalLinks(client, sections);

  if (id) {
    const { data: existing } = await client.from("content_entries").select("*").eq("id", id).single();
    if (!existing) throw new Error("Content entry not found");
    const { error: revisionError } = await client.from("content_revisions").insert({ content_entry_id: id, snapshot: existing, created_by: auth.user.id });
    if (revisionError) throw new Error("The current revision could not be preserved, so the content was not changed.");
    const { error } = await client.from("content_entries").update(toContentRow(parsed, auth.user.id)).eq("id", id);
    if (error) throw new Error(error.code === "23505" ? "That slug is already in use." : "Content could not be saved.");
    const auditAction = parsed.status === "archived" && existing.status !== "archived"
      ? "archive"
      : parsed.status === "published" && existing.status !== "published"
        ? "publish"
        : parsed.status !== "published" && existing.status === "published"
          ? "unpublish"
          : "update";
    await audit(client, auth.user.id, auditAction, parsed.kind === "article" ? "article" : "content", id, { kind: parsed.kind, slug: parsed.slug, status: parsed.status });
    if (existing.kind !== parsed.kind || existing.slug !== parsed.slug) revalidateContent(existing.kind, existing.slug);
  } else {
    const { data, error } = await client.from("content_entries").insert(toContentRow(parsed, auth.user.id)).select("id").single();
    if (error) throw new Error(error.code === "23505" ? "That slug is already in use." : "Content could not be created.");
    await audit(client, auth.user.id, parsed.status === "published" ? "publish" : "create", parsed.kind === "article" ? "article" : "content", data.id, { kind: parsed.kind, slug: parsed.slug, status: parsed.status });
  }
  revalidateContent(parsed.kind, parsed.slug);
  redirect("/admin/news");
}

export async function restoreContentRevision(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const contentId = z.string().uuid().parse(formData.get("contentId"));
  const revisionId = z.coerce.number().int().positive().parse(formData.get("revisionId"));
  const [{ data: revision }, { data: current }] = await Promise.all([
    client.from("content_revisions").select("snapshot").eq("id", revisionId).eq("content_entry_id", contentId).single(),
    client.from("content_entries").select("*").eq("id", contentId).single(),
  ]);
  if (!revision || !current) throw new Error("Revision not found");
  const snapshot = revision.snapshot as Record<string, unknown>;
  assertCustomerFacingContent(snapshot);
  const { error: revisionError } = await client.from("content_revisions").insert({ content_entry_id: contentId, snapshot: current, created_by: auth.user.id });
  if (revisionError) throw new Error("The current revision could not be preserved, so the rollback was not applied.");
  const restored = {
    kind: snapshot.kind, slug: snapshot.slug, title: snapshot.title, excerpt: snapshot.excerpt,
    sections: snapshot.sections, metadata: snapshot.metadata, seo_title: snapshot.seo_title,
    seo_description: snapshot.seo_description, status: snapshot.status, published_at: snapshot.published_at,
    author_id: auth.user.id,
  };
  const { error } = await client.from("content_entries").update(restored).eq("id", contentId);
  if (error) throw new Error("Revision could not be restored");
  await audit(client, auth.user.id, "rollback", current.kind === "article" ? "article" : "content", contentId, { revisionId });
  revalidateContent(current.kind, current.slug);
  if (snapshot.kind !== current.kind || snapshot.slug !== current.slug) {
    revalidateContent(String(snapshot.kind), String(snapshot.slug));
  }
  redirect(`/admin/news/${contentId}`);
}

export async function deleteContent(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const { data } = await client.from("content_entries").select("kind,slug").eq("id", id).single();
  if (!data) throw new Error("Content entry not found");
  const { error } = await client.from("content_entries").delete().eq("id", id);
  if (error) throw new Error("Content entry could not be deleted");
  await audit(client, auth.user.id, "delete", data.kind === "article" ? "article" : "content", id, { kind: data.kind, slug: data.slug });
  revalidateContent(data.kind, data.slug);
  revalidatePath("/admin/news");
  redirect("/admin/news");
}

function toContentRow(parsed: z.infer<typeof contentEntrySchema>, authorId: string) {
  const publishedAt = parsed.status === "scheduled" ? parsed.publishedAt : parsed.status === "published" ? new Date().toISOString() : null;
  return { kind: parsed.kind, slug: parsed.slug, title: parsed.title, excerpt: parsed.excerpt, sections: parsed.sections, metadata: parsed.metadata, seo_title: parsed.seoTitle, seo_description: parsed.seoDescription, status: parsed.status, published_at: publishedAt, author_id: authorId };
}

async function validateInternalLinks(client: NonNullable<ReturnType<typeof createAdminClient>>, sections: unknown) {
  const serialized = JSON.stringify(sections);
  const links = [...serialized.matchAll(/"href":"\/(services|diagnostics|areas|advice|news)\/([a-z0-9-]+)"/g)];
  const kindMap = { services: "service", diagnostics: "diagnostic", areas: "area", advice: "article", news: "article" } as const;
  for (const link of links) {
    const group = link[1] as keyof typeof kindMap; const slug = link[2];
    if (group === "services" && services.some((item) => item.slug === slug && item.published)) continue;
    if (group === "diagnostics" && diagnostics.some((item) => item.slug === slug && item.published)) continue;
    if (group === "areas" && slug === "doncaster") continue;
    const { data } = await client.from("content_entries").select("id").eq("kind", kindMap[group]).eq("slug", slug).eq("status", "published").maybeSingle();
    if (!data) throw new Error(`Linked content is not published: /${group}/${slug}`);
  }
}

function revalidateContent(kind: string, slug: string) {
  const prefix = kind === "service" ? "/services" : kind === "diagnostic" ? "/diagnostics" : kind === "area" ? "/areas" : kind === "article" ? "/news" : "";
  revalidatePath(prefix ? `${prefix}/${slug}` : `/${slug}`);
  if (kind === "article") {
    revalidatePath("/news");
    revalidatePath("/news/feed.xml");
    revalidatePath("/");
  }
  revalidatePath("/sitemap.xml");
}

export async function updateEnquiryStatus(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id")); const status = z.enum(["new", "contacted", "booked", "closed"]).parse(formData.get("status"));
  await client.from("enquiries").update({ status, closed_at: status === "closed" ? new Date().toISOString() : null }).eq("id", id);
  await audit(client, auth.user.id, "status_change", "enquiry", id, { status });
  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${id}`);
  revalidatePath("/admin/notifications");
}

export async function sendEnquiryReplyAction(previous: ReplyState, formData: FormData): Promise<ReplyState> {
  const { auth } = await requireAdmin();
  const enquiryId = String(formData.get("enquiryId") || "");
  const draft = String(formData.get("body") || "");
  const clientRequestId = String(formData.get("clientRequestId") || previous.clientRequestId || "");
  try {
    await sendEnquiryReply({ enquiryId, body: draft, clientRequestId, actorId: auth.user.id, actorName: auth.profile.display_name });
    revalidateEnquiryThread(enquiryId);
    return { status: "sent", message: "Reply sent to the customer.", draft: "", clientRequestId: crypto.randomUUID() };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The reply could not be sent.", draft, clientRequestId };
  }
}

export async function saveInternalNoteAction(previous: ReplyState, formData: FormData): Promise<ReplyState> {
  const { auth } = await requireAdmin();
  const enquiryId = String(formData.get("enquiryId") || "");
  const draft = String(formData.get("body") || "");
  try {
    await addInternalNote({ enquiryId, body: draft, actorId: auth.user.id, actorName: auth.profile.display_name });
    revalidateEnquiryThread(enquiryId);
    return { status: "sent", message: "Internal note saved. It was not emailed.", draft: "", clientRequestId: crypto.randomUUID() };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The note could not be saved.", draft, clientRequestId: previous.clientRequestId };
  }
}

export async function markEnquiryThreadReadAction(enquiryId: string) {
  await requireAdmin();
  await markEnquiryThreadRead(enquiryId);
  revalidateEnquiryThread(enquiryId);
}

export async function linkUnmatchedInboundAction(formData: FormData) {
  const { auth } = await requireAdmin();
  const enquiryId = await linkUnmatchedInboundEmail({
    unmatchedId: String(formData.get("unmatchedId") || ""),
    enquiryId: String(formData.get("enquiryId") || ""),
    actorId: auth.user.id,
  });
  revalidateEnquiryThread(enquiryId);
  revalidatePath("/admin/enquiries/unmatched");
  redirect(`/admin/enquiries/${enquiryId}`);
}

function revalidateEnquiryThread(enquiryId: string) {
  revalidatePath(`/admin/enquiries/${enquiryId}`);
  revalidatePath("/admin/enquiries");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin", "layout");
}

export async function resendEnquiryNotifications(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const status = await retryEnquiryNotifications(id);
  await audit(client, auth.user.id, "notification_retry", "enquiry", id, { status });
  revalidatePath("/admin/enquiries");
  revalidatePath("/admin/notifications");
}

export type NewVehicleSaveState = { status: "idle" | "error" | "saved"; message: string; vehicleId?: string };

export async function saveNewSaleVehicle(_previous: NewVehicleSaveState, formData: FormData): Promise<NewVehicleSaveState> {
  try {
    const saved = await persistSaleVehicle(formData);
    revalidateSaleVehicle(saved.slug);
    return { status: "saved", message: "Vehicle saved.", vehicleId: saved.entityId };
  } catch (error) {
    return { status: "error", message: friendlyVehicleSaveError(error) };
  }
}

export async function saveSaleVehicle(formData: FormData) {
  const saved = await persistSaleVehicle(formData);
  revalidateSaleVehicle(saved.slug);
  redirect("/admin/inventory");
}

async function persistSaleVehicle(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const schema = z.object({ id: z.string().uuid().optional(), registration: z.string().max(9).optional(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), make: z.string().min(1), model: z.string().min(1), derivative: z.string().optional(), year: z.coerce.number().int().min(1885).max(2100), mileage: z.coerce.number().int().nonnegative(), price: z.coerce.number().int().nonnegative(), fuelType: z.string().min(1), transmission: z.string().min(1), engineSize: z.string().optional(), colour: z.string().optional(), bodyType: z.string().optional(), description: z.string(), features: z.string().default(""), financeAvailable: z.coerce.boolean(), warrantyAvailable: z.coerce.boolean(), warrantyDescription: z.string().optional(), status: z.enum(["draft", "available", "reserved", "sold", "archived"]).optional(), inventoryIntent: z.enum(["draft", "publish"]).optional() });
  const parsed = schema.parse(Object.fromEntries(formData));
  const registration = parsed.registration ? normalizeRegistration(parsed.registration) : null;
  if (registration !== null && (registration.length < 2 || registration.length > 8)) throw new Error("Check the registration number and try again.");
  const status = parsed.inventoryIntent === "publish" ? "available" : parsed.inventoryIntent === "draft" ? "draft" : parsed.status || "draft";
  if (status !== "draft" && parsed.description.trim().length < 20) throw new Error("Add a vehicle description of at least 20 characters before publishing.");
  assertCustomerFacingContent({ ...parsed, registration: undefined });
  if (!parsed.id && registration) {
    const { data: existing } = await client.from("sale_vehicles").select("id").eq("registration", registration).maybeSingle();
    if (existing) throw new Error("This registration already exists in Vehicle Stock.");
  }
  const row = { registration, slug: parsed.slug, make: parsed.make, model: parsed.model, derivative: parsed.derivative || null, year: parsed.year, mileage: parsed.mileage, price: parsed.price, fuel_type: parsed.fuelType, transmission: parsed.transmission, engine_size: parsed.engineSize || null, colour: parsed.colour || null, body_type: parsed.bodyType || null, description: parsed.description.trim(), features: parsed.features.split("\n").map((value) => value.trim()).filter(Boolean), finance_available: parsed.financeAvailable, warranty: parsed.warrantyAvailable ? { available: true, description: parsed.warrantyDescription || undefined } : { available: false }, status, sold_at: status === "sold" ? new Date().toISOString() : null };
  let entityId = parsed.id;
  const previousStatus = parsed.id ? (await client.from("sale_vehicles").select("status").eq("id", parsed.id).maybeSingle()).data?.status : null;
  if (parsed.id) { const { error } = await client.from("sale_vehicles").update(row).eq("id", parsed.id); if (error) throw vehicleDatabaseError(error); } else { const { data, error } = await client.from("sale_vehicles").insert(row).select("id").single(); if (error) throw vehicleDatabaseError(error); entityId = data.id; }
  const photos = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  if (photos.length > 8 || photos.reduce((total, file) => total + file.size, 0) > 32 * 1024 * 1024) throw new Error("Choose up to eight photos with a combined size under 32 MB.");
  for (const [position, file] of photos.entries()) {
    z.object({ type: z.enum(["image/jpeg", "image/png", "image/webp"]), size: z.number().int().positive().max(8 * 1024 * 1024) }).parse({ type: file.type, size: file.size });
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${entityId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage.from("vehicle-sales").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error("The vehicle was saved, but a photo could not be uploaded.");
    const alt = `${parsed.year} ${parsed.make} ${parsed.model} vehicle photo ${position + 1}`;
    const { error: imageError } = await client.from("sale_vehicle_images").insert({ sale_vehicle_id: entityId, object_path: path, alt_text: alt, position });
    if (imageError) { await client.storage.from("vehicle-sales").remove([path]); throw new Error("The vehicle was saved, but a photo could not be added."); }
  }
  const action = status === "available" && previousStatus !== "available" ? "publish" : parsed.id ? "update" : "create";
  await audit(client, auth.user.id, action, "sale_vehicle", entityId!, { status, slug: parsed.slug, price: parsed.price, photoCount: photos.length });
  return { entityId: entityId!, slug: parsed.slug };
}

function vehicleDatabaseError(error: { code?: string }) {
  if (error.code === "23505") return new Error("This registration already exists in Vehicle Stock.");
  if (error.code === "42703" || error.code === "PGRST204" || error.code === "22P02") return new Error("Vehicle Stock needs its database update before vehicles can be saved.");
  return new Error("Vehicle could not be saved. Please check the details and try again.");
}

function friendlyVehicleSaveError(error: unknown) {
  if (error instanceof z.ZodError) return "Check the required vehicle and sales details, then try again.";
  if (error instanceof Error && [
    "This registration already exists in Vehicle Stock.",
    "Vehicle Stock needs its database update before vehicles can be saved.",
    "Vehicle could not be saved. Please check the details and try again.",
    "The vehicle was saved, but a photo could not be uploaded.",
    "The vehicle was saved, but a photo could not be added.",
    "Choose up to eight photos with a combined size under 32 MB.",
  ].includes(error.message)) return error.message;
  return "Vehicle could not be saved. Please try again.";
}

function revalidateSaleVehicle(slug: string) {
  revalidatePath("/cars-for-sale"); revalidatePath(`/cars-for-sale/${slug}`); revalidatePath("/admin/inventory"); revalidatePath("/sitemap.xml");
}

export async function uploadSaleVehicleImage(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const vehicleId = z.string().uuid().parse(formData.get("vehicleId"));
  const alt = z.string().trim().min(5).max(180).parse(formData.get("alt"));
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Select an image");
  z.object({ type: z.enum(["image/jpeg", "image/png", "image/webp"]), size: z.number().int().positive().max(12 * 1024 * 1024) }).parse({ type: file.type, size: file.size });
  assertCustomerFacingContent(alt);
  const { data: vehicle } = await client.from("sale_vehicles").select("slug").eq("id", vehicleId).single();
  if (!vehicle) throw new Error("Vehicle not found");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${vehicleId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from("vehicle-sales").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error("Vehicle image upload failed");
  const { data: last } = await client.from("sale_vehicle_images").select("position").eq("sale_vehicle_id", vehicleId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await client.from("sale_vehicle_images").insert({ sale_vehicle_id: vehicleId, object_path: path, alt_text: alt, position: (last?.position ?? -1) + 1 }).select("id").single();
  if (error) {
    await client.storage.from("vehicle-sales").remove([path]);
    throw new Error("Vehicle image could not be saved");
  }
  await audit(client, auth.user.id, "upload", "sale_vehicle_image", data.id, { vehicleId, path });
  revalidatePath(`/admin/inventory/${vehicleId}`); revalidatePath(`/cars-for-sale/${vehicle.slug}`); revalidatePath("/cars-for-sale");
}

export async function updateSaleVehicleImage(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const parsed = z.object({ id: z.string().uuid(), vehicleId: z.string().uuid(), position: z.coerce.number().int().min(0).max(100), alt: z.string().trim().min(5).max(180) }).parse(Object.fromEntries(formData));
  assertCustomerFacingContent(parsed.alt);
  const { data } = await client.from("sale_vehicle_images").update({ position: parsed.position, alt_text: parsed.alt }).eq("id", parsed.id).eq("sale_vehicle_id", parsed.vehicleId).select("id").single();
  if (!data) throw new Error("Vehicle image could not be updated");
  await audit(client, auth.user.id, "update", "sale_vehicle_image", parsed.id, { position: parsed.position });
  revalidatePath(`/admin/inventory/${parsed.vehicleId}`); revalidatePath("/cars-for-sale", "layout");
}

export async function deleteSaleVehicleImage(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const vehicleId = z.string().uuid().parse(formData.get("vehicleId"));
  const { data } = await client.from("sale_vehicle_images").select("object_path").eq("id", id).eq("sale_vehicle_id", vehicleId).single();
  if (!data) throw new Error("Vehicle image not found");
  const { error: storageError } = await client.storage.from("vehicle-sales").remove([data.object_path]);
  if (storageError) throw new Error("Vehicle image could not be removed");
  await client.from("sale_vehicle_images").delete().eq("id", id).eq("sale_vehicle_id", vehicleId);
  await audit(client, auth.user.id, "delete", "sale_vehicle_image", id, { vehicleId, path: data.object_path });
  revalidatePath(`/admin/inventory/${vehicleId}`); revalidatePath("/cars-for-sale", "layout");
}

export async function uploadMedia(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const file = formData.get("file"); const alt = z.string().min(5).max(180).parse(formData.get("alt")); const category = z.string().max(80).parse(formData.get("category"));
  if (!(file instanceof File)) throw new Error("Select an image");
  attachmentRequestSchema.parse({ name: file.name, contentType: file.type, size: file.size });
  assertCustomerFacingContent({ alt, category });
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1]; const path = `${category || "general"}/${randomUUID()}.${extension}`;
  const { error } = await client.storage.from("public-media").upload(path, file, { contentType: file.type, upsert: false }); if (error) throw new Error("Upload failed");
  const { data } = await client.from("media_assets").insert({ object_path: path, alt_text: alt, category: category || null, created_by: auth.user.id, published: false }).select("id").single();
  await audit(client, auth.user.id, "upload", "media", data?.id || path, { path }); revalidatePath("/admin/media");
}

export async function uploadArticleCover(formData: FormData): Promise<{ error?: string; asset?: { id: string; alt: string; category: string; published: boolean; url: string } }> {
  try {
    const { auth, client } = await requireAdmin();
    const file = formData.get("file");
    const alt = z.string().trim().min(5).max(180).parse(formData.get("alt"));
    if (!(file instanceof File)) return { error: "Choose a JPG, PNG or WebP image." };
    const parsedFile = attachmentRequestSchema.safeParse({ name: file.name, contentType: file.type, size: file.size });
    if (!parsedFile.success) {
      return { error: file.size > 8 * 1024 * 1024 ? "This image is too large. Please choose an image under 8 MB." : "Please upload a JPG, PNG or WebP image." };
    }
    if (!(await hasValidImageSignature(file))) return { error: "This file does not appear to be a valid JPG, PNG or WebP image." };
    assertCustomerFacingContent(alt);
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `news/${randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage.from("public-media").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return { error: "The image could not be uploaded. Please try again." };
    const { data, error: insertError } = await client.from("media_assets").insert({ object_path: path, alt_text: alt, category: "news", created_by: auth.user.id, published: false }).select("id").single();
    if (insertError || !data) {
      await client.storage.from("public-media").remove([path]);
      return { error: "The image could not be added to the Media Library. Please try again." };
    }
    await audit(client, auth.user.id, "upload", "media", data.id, { path, source: "article_cover" });
    revalidatePath("/admin/media");
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return { error: "The image was uploaded, but its preview is not configured." };
    return { asset: { id: data.id, alt, category: "news", published: false, url: `${base}/storage/v1/object/public/public-media/${path}` } };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Add useful alt text of at least five characters." };
    return { error: error instanceof Error && error.message === "Unauthorised" ? "Your admin session has expired. Refresh and sign in again." : "The image could not be uploaded. Please try again." };
  }
}

async function hasValidImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (file.type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function toggleMediaPublication(formData: FormData) { const { auth, client } = await requireAdmin(); const id = z.string().uuid().parse(formData.get("id")); const published = formData.get("published") === "true"; const { data } = await client.from("media_assets").select("alt_text").eq("id", id).single(); if (published && (!data?.alt_text || data.alt_text.trim().length < 5)) throw new Error("Alt text is required"); await client.from("media_assets").update({ published }).eq("id", id); await audit(client, auth.user.id, published ? "publish" : "unpublish", "media", id); revalidatePath("/admin/media"); revalidatePath("/gallery"); }

export async function syncGoogleReviews() {
  const { auth, client } = await requireAdmin(); const apiKey = process.env.GOOGLE_PLACES_API_KEY; const placeId = process.env.GOOGLE_PLACE_ID; if (!apiKey || !placeId) throw new Error("Google Places is not configured");
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "id,rating,userRatingCount,reviews,googleMapsUri" }, cache: "no-store" }); if (!response.ok) throw new Error("Review sync failed");
  const body = await response.json() as { googleMapsUri?: string; reviews?: Array<{ name: string; rating: number; publishTime?: string; text?: { text?: string }; authorAttribution?: { displayName?: string; uri?: string } }> };
  for (const review of body.reviews || []) { const text = review.text?.text?.trim(); if (!text) continue; try { assertCustomerFacingContent(text); } catch { continue; } await client.from("reviews").upsert({ provider: "google", provider_review_id: review.name, author_name: review.authorAttribution?.displayName || "Google user", author_uri: review.authorAttribution?.uri || null, rating: review.rating, text, published_at: review.publishTime || null, source_uri: body.googleMapsUri || "https://maps.google.com", fetched_at: new Date().toISOString() }, { onConflict: "provider_review_id" }); }
  await audit(client, auth.user.id, "sync", "reviews", placeId); revalidatePath("/admin/reviews");
}

export async function toggleReview(formData: FormData) { const { auth, client } = await requireAdmin(); const id = z.string().uuid().parse(formData.get("id")); const visible = formData.get("visible") === "true"; const { data } = await client.from("reviews").select("text").eq("id", id).single(); if (visible) assertCustomerFacingContent(data?.text || ""); await client.from("reviews").update({ visible }).eq("id", id); await audit(client, auth.user.id, visible ? "publish" : "unpublish", "review", id); revalidatePath("/admin/reviews"); revalidatePath("/reviews"); }

export async function saveSettings(formData: FormData) {
  const { auth, client } = await requireAdmin();
  const openingHours = Object.fromEntries(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "bankHolidays"]
      .map((day) => [day, String(formData.get(day) || "").trim()] as const)
      .filter(([, hours]) => hours.length > 0),
  );
  const value = {
    name: String(formData.get("name")),
    legalName: String(formData.get("legalName")),
    companyNumber: String(formData.get("companyNumber")),
    phone: String(formData.get("phone")),
    whatsapp: String(formData.get("whatsapp")),
    email: String(formData.get("email")),
    address: {
      building: String(formData.get("building")),
      street: String(formData.get("street")),
      town: String(formData.get("town")),
      city: String(formData.get("city")),
      postcode: String(formData.get("postcode")),
      country: "United Kingdom",
      countryCode: "GB",
    },
    openingHours,
    googleMapsUrl: String(formData.get("googleMapsUrl") || ""),
  };
  assertCustomerFacingContent(value);
  await client.from("site_settings").upsert({ id: true, value, updated_by: auth.user.id });
  await audit(client, auth.user.id, "update", "site_settings", "primary");
  revalidatePath("/", "layout");
  redirect("/admin/settings");
}

export async function saveOffer(formData: FormData) { const { auth, client } = await requireAdmin(); const parsed = z.object({ id: z.string().uuid().optional(), title: z.string().min(3).max(120), description: z.string().min(10).max(500), active: z.coerce.boolean() }).parse({ id: formData.get("id") || undefined, title: formData.get("title"), description: formData.get("description"), active: formData.get("active") === "on" }); assertCustomerFacingContent(parsed); let id = parsed.id; const row = { title: parsed.title, description: parsed.description, active: parsed.active }; if (id) await client.from("offers").update(row).eq("id", id); else { const { data } = await client.from("offers").insert(row).select("id").single(); id = data?.id; } await audit(client, auth.user.id, parsed.id ? "update" : "create", "offer", id || parsed.title, { active: parsed.active }); revalidatePath("/"); redirect("/admin/offers"); }

export async function saveServicePrice(formData: FormData) { const { auth, client } = await requireAdmin(); const optionalMoney = z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.number().int().nonnegative().optional()); const parsed = z.object({ serviceSlug: z.string().regex(/^[a-z0-9-]+$/), minimum: optionalMoney, maximum: optionalMoney, label: z.string().max(80).optional(), notes: z.string().max(300).optional(), published: z.coerce.boolean() }).refine((value) => value.maximum == null || value.minimum == null || value.maximum >= value.minimum, { message: "Maximum must be at least the minimum" }).parse({ serviceSlug: formData.get("serviceSlug"), minimum: formData.get("minimum"), maximum: formData.get("maximum"), label: String(formData.get("label") || ""), notes: String(formData.get("notes") || ""), published: formData.get("published") === "on" }); assertCustomerFacingContent(parsed); await client.from("service_prices").upsert({ service_slug: parsed.serviceSlug, minimum: parsed.minimum ?? null, maximum: parsed.maximum ?? null, label: parsed.label || null, notes: parsed.notes || null, published: parsed.published }); await audit(client, auth.user.id, "update", "service_price", parsed.serviceSlug, { minimum: parsed.minimum, maximum: parsed.maximum, published: parsed.published }); revalidatePath(`/services/${parsed.serviceSlug}`); revalidatePath(`/diagnostics/${parsed.serviceSlug}`); redirect("/admin/pricing"); }
