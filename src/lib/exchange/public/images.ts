import "server-only";

import sharp, { type Sharp } from "sharp";

// Server-side image checks for seller photos (ARCHITECTURE.md rule 5): the
// type comes from the file's magic bytes, never the browser's claim, and
// every image is decoded and re-encoded with sharp. Re-encoding drops all
// metadata, including EXIF GPS position and camera serial numbers.

export type AllowedImageType = "image/jpeg" | "image/png" | "image/webp";

export function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export const MAX_OUTPUT_EDGE = 2560;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export class ImageRejectedError extends Error {
  constructor(readonly reason: "unsupported" | "corrupt" | "too_large") {
    super(`Image rejected: ${reason}`);
    this.name = "ImageRejectedError";
  }
}

/**
 * Decode, auto-rotate from EXIF orientation, bound the size and re-encode in
 * the requested format with no metadata. Throws ImageRejectedError for
 * anything that is not a genuine JPEG, PNG or WebP image.
 */
export async function sanitiseImage(input: Buffer, output: AllowedImageType = "image/jpeg") {
  if (input.length === 0 || input.length > MAX_IMAGE_BYTES) throw new ImageRejectedError("too_large");
  if (!detectImageType(input)) throw new ImageRejectedError("unsupported");
  let pipeline: Sharp;
  try {
    pipeline = sharp(input, { failOn: "error", limitInputPixels: 120_000_000 })
      .rotate()
      .resize({ width: MAX_OUTPUT_EDGE, height: MAX_OUTPUT_EDGE, fit: "inside", withoutEnlargement: true });
    if (output === "image/png") pipeline = pipeline.png({ compressionLevel: 9 });
    else if (output === "image/webp") pipeline = pipeline.webp({ quality: 82 });
    else pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    if (data.length > MAX_IMAGE_BYTES) throw new ImageRejectedError("too_large");
    return { data, contentType: output, width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof ImageRejectedError) throw error;
    throw new ImageRejectedError("corrupt");
  }
}
