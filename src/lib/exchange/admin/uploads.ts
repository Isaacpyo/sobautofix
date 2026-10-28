import "server-only";

import sharp from "sharp";

export const PHOTO_MAX_BYTES = 12 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Staging area for staff photo uploads before they are checked and re-encoded. */
export const STAGING_BUCKET = "vehicle-documents";
export const STAGING_PREFIX = "staging/stock-photos";

/** Detects the real file type from its first bytes; the browser's claim is never trusted. */
export function sniffContentType(bytes: Uint8Array): DocumentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function extensionFor(type: DocumentType) {
  return type === "application/pdf" ? "pdf" : type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
}

/**
 * Re-encodes a photo: applies the EXIF orientation, then writes a fresh file
 * without metadata (sharp drops EXIF, GPS and ICC comments unless asked to
 * keep them). Very large images are reduced to a sensible web size.
 */
export async function reencodePhoto(input: Uint8Array, type: PhotoType) {
  const pipeline = sharp(input, { failOn: "error", limitInputPixels: 80_000_000 }).rotate().resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true });
  const output = type === "image/png" ? await pipeline.png({ compressionLevel: 9 }).toBuffer() : type === "image/webp" ? await pipeline.webp({ quality: 85 }).toBuffer() : await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  return new Uint8Array(output);
}

/** Keeps a safe, readable file name for display; the stored object name is random. */
export function safeFileName(name: string) {
  const cleaned = name.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  return cleaned || "document";
}
