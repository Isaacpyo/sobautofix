// Client-side photo handling for the sell form: resize on the phone before
// upload (saves mobile data), then PUT to a signed Storage URL with progress.
// The server re-checks and re-encodes every photo; nothing here is trusted.

import { SELLER_PHOTO_MAX_BYTES, sellerPhotoTypes, type SellerPhotoCategory } from "@/lib/exchange/public/schemas";

export type PhotoStatus = "ready" | "uploading" | "done" | "failed";

export type SellerPhoto = {
  key: string;
  blob: Blob;
  contentType: (typeof sellerPhotoTypes)[number];
  previewUrl: string;
  category: SellerPhotoCategory;
  status: PhotoStatus;
  progress: number;
  error?: string;
  photoId?: string;
};

const MAX_EDGE = 2048;

export function isAllowedPhotoType(type: string): type is SellerPhoto["contentType"] {
  return (sellerPhotoTypes as readonly string[]).includes(type);
}

/** Resize to at most 2048px on the long edge as JPEG. Falls back to the original when resizing is unavailable. */
export async function preparePhoto(file: File): Promise<{ blob: Blob; contentType: SellerPhoto["contentType"] }> {
  if (!isAllowedPhotoType(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob && (blob.size < file.size || file.size > SELLER_PHOTO_MAX_BYTES)) {
      if (blob.size > SELLER_PHOTO_MAX_BYTES) throw new Error("too large");
      return { blob, contentType: "image/jpeg" };
    }
  } catch {
    // Fall through to the original file.
  }
  if (file.size > SELLER_PHOTO_MAX_BYTES) throw new Error("This photo is larger than 8 MB. Please choose a smaller one.");
  return { blob: file, contentType: file.type as SellerPhoto["contentType"] };
}

/** PUT a blob to a Supabase signed upload URL, reporting progress from 0 to 1. */
export function putWithProgress(url: string, blob: Blob, contentType: string, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("content-type", contentType);
    request.setRequestHeader("x-upsert", "true");
    request.setRequestHeader("cache-control", "max-age=3600");
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (key) request.setRequestHeader("apikey", key);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`upload ${request.status}`)));
    request.onerror = () => reject(new Error("network"));
    request.ontimeout = () => reject(new Error("timeout"));
    request.timeout = 120_000;
    request.send(blob);
  });
}

type UploadContext = { submissionId: string; uploadToken: string };

/** Sign, upload and finalise one photo. Returns the server photo id. */
export async function uploadSellerPhoto(context: UploadContext, photo: SellerPhoto, onProgress: (fraction: number) => void) {
  const headers = { "Content-Type": "application/json", "x-upload-token": context.uploadToken };
  const signResponse = await fetch(`/api/exchange/seller-submissions/${context.submissionId}/photos/sign`, {
    method: "POST",
    headers,
    body: JSON.stringify({ contentType: photo.contentType, size: photo.blob.size, category: photo.category, ...(photo.photoId ? { photoId: photo.photoId } : {}) }),
  });
  const signed = await signResponse.json().catch(() => null) as null | { success?: boolean; photoId?: string; signedUrl?: string; error?: { message?: string } };
  if (!signResponse.ok || !signed?.photoId || !signed.signedUrl) throw new Error(signed?.error?.message || "Could not start the upload.");
  const photoId = signed.photoId;
  try {
    await putWithProgress(signed.signedUrl, photo.blob, photo.contentType, onProgress);
  } catch {
    throw Object.assign(new Error("The upload was interrupted. Check your connection and retry."), { photoId });
  }
  const finalResponse = await fetch(`/api/exchange/seller-submissions/${context.submissionId}/photos/finalize`, { method: "POST", headers, body: JSON.stringify({ photoId }) });
  const finalBody = await finalResponse.json().catch(() => null) as null | { success?: boolean; error?: { message?: string; code?: string } };
  if (!finalResponse.ok || !finalBody?.success) {
    // A rejected photo was deleted on the server; a retry starts afresh.
    const keepId = finalBody?.error?.code === "REJECTED" ? undefined : photoId;
    throw Object.assign(new Error(finalBody?.error?.message || "The photo could not be saved."), { photoId: keepId });
  }
  return photoId;
}
