import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { detectImageType, ImageRejectedError, MAX_IMAGE_BYTES, sanitiseImage, type AllowedImageType } from "./images";
import { SELLER_PHOTO_LIMIT, type SellerPhotoCategory } from "./schemas";

// Seller photos go to the private bucket through short-lived signed upload
// URLs. Nothing is trusted until finalisePhoto() has downloaded the object,
// checked its magic bytes and re-encoded it without metadata.

export const SELLER_PHOTO_BUCKET = "seller-submission-photos";

export type PhotoFailure = "NOT_FOUND" | "LIMIT" | "UNAVAILABLE" | "UPLOAD_MISSING" | "REJECTED";

export class PhotoError extends Error {
  constructor(readonly code: PhotoFailure, message: string) {
    super(message);
    this.name = "PhotoError";
  }
}

const extensions: Record<AllowedImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function client() {
  const admin = createAdminClient();
  if (!admin) throw new PhotoError("UNAVAILABLE", "Photo uploads are temporarily unavailable.");
  return admin;
}

async function requireSubmission(admin: ReturnType<typeof client>, submissionId: string) {
  const { data } = await admin.from("seller_submissions").select("id,anonymised_at,status").eq("id", submissionId).maybeSingle();
  if (!data || data.anonymised_at || ["declined", "closed"].includes(data.status)) throw new PhotoError("NOT_FOUND", "This enquiry can no longer accept photos.");
}

/**
 * Prepare an upload. Passing an existing, unfinished photoId re-signs the
 * same object (a retry), so failed attempts never use up the 12-photo limit.
 */
export async function signPhotoUpload(submissionId: string, input: { contentType: AllowedImageType; size: number; category: SellerPhotoCategory; photoId?: string }) {
  const admin = client();
  await requireSubmission(admin, submissionId);

  if (input.photoId) {
    const { data: existing } = await admin.from("seller_submission_photos").select("id,object_path,finalised,content_type").eq("id", input.photoId).eq("submission_id", submissionId).maybeSingle();
    if (existing && !existing.finalised) {
      await admin.from("seller_submission_photos").update({ size_bytes: input.size, category: input.category }).eq("id", existing.id);
      const { data, error } = await admin.storage.from(SELLER_PHOTO_BUCKET).createSignedUploadUrl(existing.object_path, { upsert: true });
      if (error || !data) throw new PhotoError("UNAVAILABLE", "Could not prepare the upload.");
      return { photoId: existing.id, signedUrl: data.signedUrl, path: data.path, token: data.token, contentType: existing.content_type as AllowedImageType };
    }
  }

  const { count } = await admin.from("seller_submission_photos").select("id", { count: "exact", head: true }).eq("submission_id", submissionId);
  if ((count || 0) >= SELLER_PHOTO_LIMIT) throw new PhotoError("LIMIT", `You can add up to ${SELLER_PHOTO_LIMIT} photos.`);

  const photoId = randomUUID();
  const extension = extensions[input.contentType];
  const objectPath = `${submissionId}/${photoId}.${extension}`;
  const { error: insertError } = await admin.from("seller_submission_photos").insert({
    id: photoId,
    submission_id: submissionId,
    object_path: objectPath,
    // Never store the visitor's own file name: it can contain personal details.
    file_name: `${input.category}-${(count || 0) + 1}.${extension}`,
    content_type: input.contentType,
    size_bytes: input.size,
    category: input.category,
  });
  if (insertError) throw new PhotoError("UNAVAILABLE", "Could not prepare the upload.");
  const { data, error } = await admin.storage.from(SELLER_PHOTO_BUCKET).createSignedUploadUrl(objectPath, { upsert: true });
  if (error || !data) {
    await admin.from("seller_submission_photos").delete().eq("id", photoId);
    throw new PhotoError("UNAVAILABLE", "Could not prepare the upload.");
  }
  return { photoId, signedUrl: data.signedUrl, path: data.path, token: data.token, contentType: input.contentType };
}

/** Download the uploaded object, verify it is a real image, strip metadata and mark it finalised. */
export async function finalisePhoto(submissionId: string, photoId: string) {
  const admin = client();
  const { data: photo } = await admin.from("seller_submission_photos").select("id,object_path,content_type,finalised").eq("id", photoId).eq("submission_id", submissionId).maybeSingle();
  if (!photo) throw new PhotoError("NOT_FOUND", "Photo not found.");
  if (photo.finalised) return { photoId, alreadyFinalised: true };

  const { data: blob, error } = await admin.storage.from(SELLER_PHOTO_BUCKET).download(photo.object_path);
  if (error || !blob) throw new PhotoError("UPLOAD_MISSING", "The photo did not finish uploading. Please try again.");
  const original = Buffer.from(await blob.arrayBuffer());

  const reject = async (message: string) => {
    await admin.storage.from(SELLER_PHOTO_BUCKET).remove([photo.object_path]);
    await admin.from("seller_submission_photos").delete().eq("id", photo.id);
    return new PhotoError("REJECTED", message);
  };
  if (original.length > MAX_IMAGE_BYTES) throw await reject("Photos must be 8 MB or smaller.");
  if (!detectImageType(original)) throw await reject("That file is not a JPG, PNG or WebP photo.");

  let clean: Awaited<ReturnType<typeof sanitiseImage>>;
  try {
    clean = await sanitiseImage(original, photo.content_type as AllowedImageType);
  } catch (rejection) {
    throw await reject(rejection instanceof ImageRejectedError && rejection.reason === "too_large" ? "That photo is too large. Please choose a smaller one." : "That photo could not be read. Please choose another.");
  }

  const { error: uploadError } = await admin.storage.from(SELLER_PHOTO_BUCKET).upload(photo.object_path, clean.data, { contentType: clean.contentType, upsert: true });
  if (uploadError) throw new PhotoError("UNAVAILABLE", "Could not save the photo. Please try again.");
  const { error: updateError } = await admin.from("seller_submission_photos").update({ finalised: true, size_bytes: clean.data.length, content_type: clean.contentType }).eq("id", photo.id);
  if (updateError) throw new PhotoError("UNAVAILABLE", "Could not save the photo. Please try again.");
  return { photoId, alreadyFinalised: false };
}
