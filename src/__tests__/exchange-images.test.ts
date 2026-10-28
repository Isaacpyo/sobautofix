import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImageType, ImageRejectedError, sanitiseImage } from "@/lib/exchange/public/images";

async function photoWithLocation(width = 1200, height = 800) {
  return sharp({ create: { width, height, channels: 3, background: { r: 25, g: 116, b: 226 } } })
    .jpeg()
    .withExif({ IFD0: { Make: "TestPhone", Model: "Leaky 1" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "53/1 35/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "1/1 10/1 0/1" } })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

describe("seller photo sanitising", () => {
  it("detects the real type from magic bytes, not the file name", async () => {
    const jpeg = await photoWithLocation(10, 10);
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "white" } }).png().toBuffer();
    const webp = await sharp({ create: { width: 4, height: 4, channels: 3, background: "white" } }).webp().toBuffer();
    expect(detectImageType(jpeg)).toBe("image/jpeg");
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(webp)).toBe("image/webp");
    expect(detectImageType(Buffer.from("%PDF-1.7 pretending to be a photo"))).toBeNull();
    expect(detectImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });

  it("strips EXIF including GPS, applies the orientation and re-encodes", async () => {
    const original = await photoWithLocation();
    expect((await sharp(original).metadata()).exif).toBeTruthy();
    expect(original.includes(Buffer.from("Leaky 1"))).toBe(true);
    const clean = await sanitiseImage(original, "image/jpeg");
    const metadata = await sharp(clean.data).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe("jpeg");
    // Orientation 6 (rotate 90 degrees) is applied to the pixels, so the photo is now portrait.
    expect([metadata.width, metadata.height]).toEqual([800, 1200]);
    expect(clean.data.includes(Buffer.from("Leaky 1"))).toBe(false);
  });

  it("bounds very large photos", async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "grey" } }).jpeg().toBuffer();
    const clean = await sanitiseImage(big, "image/jpeg");
    expect(Math.max(clean.width, clean.height)).toBe(2560);
  });

  it("rejects files that are not images or are corrupt", async () => {
    await expect(sanitiseImage(Buffer.from("hello world, not an image"))).rejects.toBeInstanceOf(ImageRejectedError);
    const truncated = (await photoWithLocation()).subarray(0, 200);
    await expect(sanitiseImage(truncated)).rejects.toMatchObject({ reason: "corrupt" });
    await expect(sanitiseImage(Buffer.alloc(0))).rejects.toMatchObject({ reason: "too_large" });
  });
});
