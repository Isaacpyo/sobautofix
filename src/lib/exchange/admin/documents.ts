import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { documentKinds } from "@/components/admin/exchange/labels";
import { auditStaffAction, type StaffContext } from "@/lib/exchange/staff";
import { assertCan, ExchangeUserError, guardCopy, must } from "./core";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_TYPES,
  extensionFor,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  reencodePhoto,
  safeFileName,
  sniffContentType,
  STAGING_BUCKET,
  STAGING_PREFIX,
  type PhotoType,
} from "./uploads";

const DOCUMENT_BUCKET = "vehicle-documents";
const PHOTO_BUCKET = "vehicle-sales";

export const signRequestSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("stock_photo"), vehicleId: z.string().uuid(), fileName: z.string().min(1).max(300), contentType: z.enum(PHOTO_TYPES, { error: "Choose a JPG, PNG or WebP photo." }), size: z.number().int().positive().max(PHOTO_MAX_BYTES, "Each photo must be 12 MB or smaller.") }),
  z.object({ target: z.literal("document"), vehicleId: z.string().uuid().optional(), submissionId: z.string().uuid().optional(), fileName: z.string().min(1).max(300), contentType: z.enum(DOCUMENT_TYPES, { error: "Choose a PDF, JPG, PNG or WebP file." }), size: z.number().int().positive().max(DOCUMENT_MAX_BYTES, "Documents must be 15 MB or smaller.") }),
]);

export const finalizeRequestSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("stock_photo"), vehicleId: z.string().uuid(), path: z.string().min(1).max(300), fileName: z.string().min(1).max(300), alt: z.string().trim().max(180).optional() }),
  z.object({ target: z.literal("document"), vehicleId: z.string().uuid().optional(), submissionId: z.string().uuid().optional(), path: z.string().min(1).max(300), fileName: z.string().min(1).max(300), kind: z.enum(documentKinds).default("other") }),
]);

export type SignRequest = z.infer<typeof signRequestSchema>;
export type FinalizeRequest = z.infer<typeof finalizeRequestSchema>;

/** Object paths are always generated here; finalize accepts only paths of this exact shape. */
function ownerFolder(request: { vehicleId?: string; submissionId?: string }) {
  if (request.vehicleId) return `stock/${request.vehicleId}`;
  if (request.submissionId) return `submissions/${request.submissionId}`;
  throw new ExchangeUserError("Choose the vehicle or enquiry this document belongs to.");
}

function expectedPrefix(request: SignRequest | FinalizeRequest) {
  return request.target === "stock_photo" ? `${STAGING_PREFIX}/${request.vehicleId}/` : `${ownerFolder(request)}/`;
}

export function isAllowedUploadPath(request: FinalizeRequest) {
  const prefix = expectedPrefix(request);
  return request.path.startsWith(prefix) && /^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(request.path.slice(prefix.length));
}

async function assertOwnerExists(staff: StaffContext, request: { vehicleId?: string; submissionId?: string }) {
  if (request.vehicleId) {
    const { data } = await staff.client.from("sale_vehicles").select("id").eq("id", request.vehicleId).is("deleted_at", null).maybeSingle();
    if (!data) throw new ExchangeUserError("This vehicle no longer exists.");
  } else if (request.submissionId) {
    const { data } = await staff.client.from("seller_submissions").select("id").eq("id", request.submissionId).maybeSingle();
    if (!data) throw new ExchangeUserError("This enquiry no longer exists.");
  }
}

export function uploadPermission(request: { target: string; submissionId?: string }) {
  if (request.target === "stock_photo") return "stock.edit" as const;
  return request.submissionId ? ("buying.manage" as const) : ("prep.manage" as const);
}

export async function signUpload(staff: StaffContext, request: SignRequest) {
  assertCan(staff, uploadPermission(request));
  await assertOwnerExists(staff, request);
  const path = `${expectedPrefix(request)}${randomUUID()}.${extensionFor(request.contentType)}`;
  const bucket = request.target === "stock_photo" ? STAGING_BUCKET : DOCUMENT_BUCKET;
  const { data, error } = await staff.client.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new ExchangeUserError("The upload could not be prepared. Try again.");
  return { bucket, path: data.path, token: data.token };
}

async function download(staff: StaffContext, bucket: string, path: string) {
  const { data, error } = await staff.client.storage.from(bucket).download(path);
  if (error || !data) throw new ExchangeUserError("The uploaded file could not be found. Upload it again.");
  return new Uint8Array(await data.arrayBuffer());
}

export async function finalizeUpload(staff: StaffContext, request: FinalizeRequest) {
  assertCan(staff, uploadPermission(request));
  if (!isAllowedUploadPath(request)) throw new ExchangeUserError("That upload does not belong to this record.");
  await assertOwnerExists(staff, request);
  return request.target === "stock_photo" ? finalizePhoto(staff, request) : finalizeDocument(staff, request);
}

async function finalizePhoto(staff: StaffContext, request: Extract<FinalizeRequest, { target: "stock_photo" }>) {
  const bytes = await download(staff, STAGING_BUCKET, request.path);
  try {
    if (bytes.byteLength > PHOTO_MAX_BYTES) throw new ExchangeUserError("Each photo must be 12 MB or smaller.");
    const type = sniffContentType(bytes);
    if (!type || type === "application/pdf") throw new ExchangeUserError("This file is not a valid JPG, PNG or WebP photo.");
    let encoded: Uint8Array;
    try {
      encoded = await reencodePhoto(bytes, type as PhotoType);
    } catch {
      throw new ExchangeUserError("This photo could not be read. Try exporting it again as a JPG.");
    }
    const alt = request.alt?.trim() || "";
    if (alt) guardCopy({ alt });
    const { data: vehicle } = await staff.client.from("sale_vehicles").select("year,make,model,slug").eq("id", request.vehicleId).single();
    const { data: last } = await staff.client.from("sale_vehicle_images").select("position").eq("sale_vehicle_id", request.vehicleId).order("position", { ascending: false }).limit(1).maybeSingle();
    const position = (last?.position ?? -1) + 1;
    const finalPath = `${request.vehicleId}/${randomUUID()}.${extensionFor(type)}`;
    const { error: uploadError } = await staff.client.storage.from(PHOTO_BUCKET).upload(finalPath, encoded, { contentType: type, upsert: false, cacheControl: "31536000" });
    if (uploadError) throw new ExchangeUserError("The photo could not be stored. Try again.");
    const fallbackAlt = `${[vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" ")} photo ${position + 1}`.trim();
    const inserted = await staff.client.from("sale_vehicle_images").insert({ sale_vehicle_id: request.vehicleId, object_path: finalPath, alt_text: (alt.length >= 5 ? alt : fallbackAlt).slice(0, 180), position }).select("id").single();
    if (inserted.error || !inserted.data) {
      await staff.client.storage.from(PHOTO_BUCKET).remove([finalPath]);
      throw new ExchangeUserError("The photo could not be added. Try again.");
    }
    await auditStaffAction(staff, "photo_uploaded", "sale_vehicle", request.vehicleId, { photoId: inserted.data.id, bytes: encoded.byteLength });
    return { id: inserted.data.id as string, slug: vehicle?.slug as string | undefined };
  } finally {
    await staff.client.storage.from(STAGING_BUCKET).remove([request.path]);
  }
}

async function finalizeDocument(staff: StaffContext, request: Extract<FinalizeRequest, { target: "document" }>) {
  const bytes = await download(staff, DOCUMENT_BUCKET, request.path);
  const type = sniffContentType(bytes);
  const expectedExtension = request.path.split(".").pop();
  if (!type || bytes.byteLength > DOCUMENT_MAX_BYTES || extensionFor(type) !== expectedExtension) {
    await staff.client.storage.from(DOCUMENT_BUCKET).remove([request.path]);
    throw new ExchangeUserError(bytes.byteLength > DOCUMENT_MAX_BYTES ? "Documents must be 15 MB or smaller." : "This file is not a valid PDF, JPG, PNG or WebP document.");
  }
  const inserted = await staff.client.from("vehicle_documents").insert({
    sale_vehicle_id: request.vehicleId || null,
    seller_submission_id: request.submissionId || null,
    kind: request.kind,
    file_name: safeFileName(request.fileName),
    object_path: request.path,
    content_type: type,
    size_bytes: bytes.byteLength,
    uploaded_by: staff.userId,
  }).select("id").single();
  if (inserted.error || !inserted.data) {
    await staff.client.storage.from(DOCUMENT_BUCKET).remove([request.path]);
    throw new ExchangeUserError("The document could not be saved. Try again.");
  }
  const entity = request.vehicleId ? ["sale_vehicle", request.vehicleId] : ["seller_submission", request.submissionId!];
  await auditStaffAction(staff, "document_uploaded", entity[0]!, entity[1]!, { documentId: inserted.data.id, kind: request.kind });
  return { id: inserted.data.id as string };
}

export async function deleteDocument(staff: StaffContext, documentId: string) {
  assertCan(staff, "prep.manage");
  const document = must(await staff.client.from("vehicle_documents").select("id,object_path,sale_vehicle_id,seller_submission_id,kind").eq("id", documentId).maybeSingle(), "The document could not be loaded.");
  if (!document) throw new ExchangeUserError("That document no longer exists.");
  const { error } = await staff.client.storage.from(DOCUMENT_BUCKET).remove([document.object_path]);
  if (error) throw new ExchangeUserError("The document could not be removed. Try again.");
  must(await staff.client.from("vehicle_documents").delete().eq("id", documentId), "The document could not be removed.");
  const entity = document.sale_vehicle_id ? ["sale_vehicle", document.sale_vehicle_id] : ["seller_submission", document.seller_submission_id];
  await auditStaffAction(staff, "document_deleted", entity[0], entity[1], { documentId, kind: document.kind });
}

/** Who may open a private document: staff who work stock, preparation or buying. */
export function canViewDocuments(staff: Pick<StaffContext, "can">, document: { seller_submission_id: string | null; sale_vehicle_id: string | null }) {
  if (document.seller_submission_id && !document.sale_vehicle_id) return staff.can("buying.manage") || staff.can("prep.manage");
  return staff.can("stock.edit") || staff.can("prep.manage");
}

/** A 60-second signed link, issued per click, so a copied URL soon stops working. */
export async function documentDownloadUrl(staff: StaffContext, documentId: string) {
  const { data: document } = await staff.client.from("vehicle_documents").select("id,object_path,file_name,sale_vehicle_id,seller_submission_id").eq("id", documentId).maybeSingle();
  if (!document) return { status: 404 as const };
  if (!canViewDocuments(staff, document)) return { status: 403 as const };
  const { data, error } = await staff.client.storage.from(DOCUMENT_BUCKET).createSignedUrl(document.object_path, 60, { download: document.file_name });
  if (error || !data) return { status: 502 as const };
  return { status: 200 as const, url: data.signedUrl };
}

export async function submissionPhotoUrl(staff: StaffContext, photoId: string) {
  if (!staff.can("buying.manage")) return { status: 403 as const };
  const { data: photo } = await staff.client.from("seller_submission_photos").select("object_path").eq("id", photoId).maybeSingle();
  if (!photo) return { status: 404 as const };
  const { data, error } = await staff.client.storage.from("seller-submission-photos").createSignedUrl(photo.object_path, 60);
  if (error || !data) return { status: 502 as const };
  return { status: 200 as const, url: data.signedUrl };
}
