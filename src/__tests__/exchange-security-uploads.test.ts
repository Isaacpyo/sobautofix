import { describe, expect, it } from "vitest";

// Independent verification of upload handling (ARCHITECTURE.md rule 5):
// real type from magic bytes, size limits, metadata stripped by re-encoding,
// and object paths the server chooses. The customer and staff lanes' modules
// load through import.meta.glob, so this file skips until they are merged.

const modules = import.meta.glob([
  "../lib/exchange/public/images.ts",
  "../lib/exchange/public/schemas.ts",
  "../lib/exchange/public/upload-token.ts",
  "../lib/exchange/admin/uploads.ts",
  "../lib/exchange/admin/documents.ts",
]);
const has = (path: string) => Boolean(modules[path]);
const load = async <T,>(path: string) => (await modules[path]!()) as T;

type Sharp = (input?: unknown, options?: unknown) => { jpeg: () => { withExif: (exif: unknown) => { toBuffer: () => Promise<Buffer> }; toBuffer: () => Promise<Buffer> }; metadata: () => Promise<{ exif?: Buffer; format?: string }> };
async function loadSharp(): Promise<Sharp | null> {
  const name = "sharp";
  try {
    const module = await import(/* @vite-ignore */ name);
    return (module.default ?? module) as Sharp;
  } catch {
    return null;
  }
}

const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webpHeader = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
const disguised = [
  new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"),
  new TextEncoder().encode("<!doctype html><html><body>not a photo</body></html>"),
  new TextEncoder().encode("GIF89a........"),
  new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), // Windows executable
];

async function photoWithExif(sharp: Sharp) {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .jpeg()
    .withExif({ IFD0: { Artist: "Seller Name", Copyright: "Private", ImageDescription: "Taken at 1 Private Road" } })
    .toBuffer();
}

type PublicImages = { detectImageType: (bytes: Uint8Array) => string | null; sanitiseImage: (input: Buffer, type?: string) => Promise<{ data: Buffer }>; MAX_IMAGE_BYTES: number };
type AdminUploads = { sniffContentType: (bytes: Uint8Array) => string | null; reencodePhoto: (input: Uint8Array, type: string) => Promise<Uint8Array>; safeFileName: (name: string) => string };
type Documents = { isAllowedUploadPath: (request: Record<string, unknown>) => boolean; signRequestSchema: { safeParse: (value: unknown) => { success: boolean } } };
type PublicSchemas = { sellerPhotoSignSchema: { safeParse: (value: unknown) => { success: boolean } }; SELLER_PHOTO_LIMIT: number };
type UploadToken = { createSellerUploadToken: (id: string, now?: number) => string; verifySellerUploadToken: (token: string | null, id: string, now?: number) => boolean };

describe.skipIf(!has("../lib/exchange/public/images.ts"))("seller photos (customer lane)", () => {
  it("decides the type from the file's bytes, not its name or the browser's claim", async () => {
    const { detectImageType } = await load<PublicImages>("../lib/exchange/public/images.ts");
    expect(detectImageType(jpegHeader)).toBe("image/jpeg");
    expect(detectImageType(pngHeader)).toBe("image/png");
    expect(detectImageType(webpHeader)).toBe("image/webp");
    for (const bytes of disguised) expect(detectImageType(bytes)).toBeNull();
  });

  it("refuses files over 8 MB and anything that is not a real image", async () => {
    const { sanitiseImage, MAX_IMAGE_BYTES } = await load<PublicImages>("../lib/exchange/public/images.ts");
    expect(MAX_IMAGE_BYTES).toBe(8 * 1024 * 1024);
    await expect(sanitiseImage(Buffer.alloc(MAX_IMAGE_BYTES + 1, 0xff))).rejects.toThrow();
    await expect(sanitiseImage(Buffer.from(disguised[0]!))).rejects.toThrow();
    await expect(sanitiseImage(Buffer.concat([Buffer.from(jpegHeader), Buffer.alloc(200, 7)]))).rejects.toThrow();
  });

  it("strips EXIF metadata (names, locations, descriptions) when re-encoding", async () => {
    const sharp = await loadSharp();
    if (!sharp) return;
    const { sanitiseImage } = await load<PublicImages>("../lib/exchange/public/images.ts");
    const original = await photoWithExif(sharp);
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const clean = await sanitiseImage(original, "image/jpeg");
    const metadata = await sharp(clean.data).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.exif).toBeUndefined();
    expect(clean.data.includes(Buffer.from("Private Road"))).toBe(false);
  });
});

describe.skipIf(!has("../lib/exchange/public/schemas.ts"))("seller photo limits (customer lane)", () => {
  it("caps size and count before an upload URL is issued", async () => {
    const { sellerPhotoSignSchema, SELLER_PHOTO_LIMIT } = await load<PublicSchemas>("../lib/exchange/public/schemas.ts");
    expect(SELLER_PHOTO_LIMIT).toBe(12);
    expect(sellerPhotoSignSchema.safeParse({ contentType: "image/jpeg", size: 8 * 1024 * 1024, category: "exterior" }).success).toBe(true);
    expect(sellerPhotoSignSchema.safeParse({ contentType: "image/jpeg", size: 8 * 1024 * 1024 + 1, category: "exterior" }).success).toBe(false);
    expect(sellerPhotoSignSchema.safeParse({ contentType: "image/svg+xml", size: 1000, category: "exterior" }).success).toBe(false);
  });
});

describe.skipIf(!has("../lib/exchange/public/upload-token.ts"))("seller upload sessions (customer lane)", () => {
  it("binds the upload token to one submission and expires it", async () => {
    const { createSellerUploadToken, verifySellerUploadToken } = await load<UploadToken>("../lib/exchange/public/upload-token.ts");
    const id = "6f1d2c3b-4a59-4e8d-9c7b-1a2b3c4d5e6f";
    const now = Date.UTC(2026, 9, 28, 12);
    const token = createSellerUploadToken(id, now);
    expect(verifySellerUploadToken(token, id, now)).toBe(true);
    expect(verifySellerUploadToken(token, "7f1d2c3b-4a59-4e8d-9c7b-1a2b3c4d5e6f", now)).toBe(false);
    expect(verifySellerUploadToken(token, id, now + 3 * 3_600_000)).toBe(false);
    expect(verifySellerUploadToken(`${token.slice(0, -2)}xx`, id, now)).toBe(false);
    expect(verifySellerUploadToken(null, id, now)).toBe(false);
  });
});

describe.skipIf(!has("../lib/exchange/admin/uploads.ts"))("staff photos and documents (staff operations lane)", () => {
  it("decides the type from the bytes, including PDFs, and rejects disguised files", async () => {
    const { sniffContentType } = await load<AdminUploads>("../lib/exchange/admin/uploads.ts");
    expect(sniffContentType(new TextEncoder().encode("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffContentType(jpegHeader)).toBe("image/jpeg");
    for (const bytes of disguised) expect(sniffContentType(bytes)).toBeNull();
  });

  it("strips EXIF from stock photos", async () => {
    const sharp = await loadSharp();
    if (!sharp) return;
    const { reencodePhoto } = await load<AdminUploads>("../lib/exchange/admin/uploads.ts");
    const output = await reencodePhoto(await photoWithExif(sharp), "image/jpeg");
    expect((await sharp(Buffer.from(output)).metadata()).exif).toBeUndefined();
  });

  it("never lets a file name escape or carry control characters", async () => {
    const { safeFileName } = await load<AdminUploads>("../lib/exchange/admin/uploads.ts");
    expect(safeFileName("../../etc/passwd")).not.toContain("/");
    expect(safeFileName("a\u0000b\nc.pdf")).toBe("a b c.pdf");
  });

  // Reported to the coordinator: JPG/PNG/WebP files uploaded as documents are
  // stored as uploaded, so their EXIF/GPS metadata is kept (rule 5 says re-encode).
  it.todo("re-encodes image documents to remove metadata before storing them");
});

describe.skipIf(!has("../lib/exchange/admin/documents.ts"))("upload paths and limits (staff operations lane)", () => {
  it("only accepts server-generated paths under the record's own folder", async () => {
    const { isAllowedUploadPath } = await load<Documents>("../lib/exchange/admin/documents.ts");
    const vehicleId = "0f1e2d3c-4b5a-4968-8776-655443322110";
    const good = `stock/${vehicleId}/8e1b7c3a-1d2e-4f50-9a6b-7c8d9e0f1a2b.pdf`;
    expect(isAllowedUploadPath({ target: "document", vehicleId, path: good, fileName: "x.pdf", kind: "other" })).toBe(true);
    for (const path of [`stock/${vehicleId}/../other/8e1b7c3a-1d2e-4f50-9a6b-7c8d9e0f1a2b.pdf`, `stock/5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d/8e1b7c3a-1d2e-4f50-9a6b-7c8d9e0f1a2b.pdf`, `stock/${vehicleId}/invoice.pdf`, `stock/${vehicleId}/8e1b7c3a-1d2e-4f50-9a6b-7c8d9e0f1a2b.html`]) {
      expect(isAllowedUploadPath({ target: "document", vehicleId, path, fileName: "x.pdf", kind: "other" }), path).toBe(false);
    }
  });

  it("caps documents at 15 MB and photos at their limit", async () => {
    const { signRequestSchema } = await load<Documents>("../lib/exchange/admin/documents.ts");
    const vehicleId = "0f1e2d3c-4b5a-4968-8776-655443322110";
    expect(signRequestSchema.safeParse({ target: "document", vehicleId, fileName: "a.pdf", contentType: "application/pdf", size: 15 * 1024 * 1024 }).success).toBe(true);
    expect(signRequestSchema.safeParse({ target: "document", vehicleId, fileName: "a.pdf", contentType: "application/pdf", size: 15 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(signRequestSchema.safeParse({ target: "document", vehicleId, fileName: "a.svg", contentType: "image/svg+xml", size: 100 }).success).toBe(false);
  });

  // Reported to the coordinator: submissionPhotoUrl signs any seller photo row,
  // including ones never finalised (not yet checked or re-encoded).
  it.todo("only issues signed links for finalised seller photos");
  // Reported: a retried finalize hits the unique object_path, and the error path
  // then deletes the file the first row still points to.
  it.todo("treats a repeated document finalize as success without deleting the stored file");
});
