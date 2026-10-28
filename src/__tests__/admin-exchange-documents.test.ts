import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { can, type StaffRole } from "@/lib/exchange/permissions";

// Private documents and seller photos: re-encoding, idempotent finalize,
// finance-only document kinds and the staging cleanup, against a fake client.

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  objects: new Map<string, Uint8Array>(),
  removed: [] as string[],
  uploads: [] as Array<{ path: string; bytes: Uint8Array; upsert?: boolean }>,
  insertError: null as { code: string } | null,
  onInsert: null as null | (() => void),
  folders: {} as Record<string, Array<{ name: string; id: string | null; created_at?: string }>>,
}));

function table(name: string) {
  const filters: Array<[string, unknown]> = [];
  let op = "select";
  let values: Row | null = null;
  const rows = () => (db.tables[name] || []).filter((row) => filters.every(([key, value]) => row[key] === value));
  const run = () => {
    if (op === "insert") {
      db.onInsert?.();
      if (db.insertError) return { data: null, error: db.insertError };
      const row = { id: `doc-${(db.tables[name] || []).length + 1}`, ...values };
      db.tables[name] = [...(db.tables[name] || []), row];
      return { data: row, error: null };
    }
    if (op === "delete") {
      const gone = rows();
      db.tables[name] = (db.tables[name] || []).filter((row) => !gone.includes(row));
      return { data: gone, error: null };
    }
    return { data: rows(), error: null };
  };
  const chain: Record<string, unknown> = {
    select: () => chain,
    insert: (row: Row) => { op = "insert"; values = row; return chain; },
    delete: () => { op = "delete"; return chain; },
    eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
    is: () => chain,
    order: () => chain,
    single: async () => { const result = run(); return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error }; },
    maybeSingle: async () => { const result = run(); return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error }; },
    then: (resolve: (value: unknown) => void) => resolve(run()),
  };
  return chain;
}

const client = {
  from: table,
  storage: {
    from: () => ({
      download: async (path: string) => db.objects.has(path) ? { data: new Blob([Buffer.from(db.objects.get(path)!)]), error: null } : { data: null, error: { message: "missing" } },
      upload: async (path: string, bytes: Uint8Array, options: { upsert?: boolean }) => { db.uploads.push({ path, bytes, upsert: options.upsert }); db.objects.set(path, bytes); return { data: { path }, error: null }; },
      remove: async (paths: string[]) => { db.removed.push(...paths); for (const path of paths) db.objects.delete(path); return { data: [], error: null }; },
      createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed.test/${path}` }, error: null }),
      list: async (prefix: string) => ({ data: db.folders[prefix] || [], error: null }),
    }),
  },
};

vi.mock("@/lib/exchange/staff", () => ({ auditStaffAction: async () => undefined }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => client }));

import { finalizeUpload } from "@/lib/exchange/admin/documents";

const vehicleId = "00000000-0000-4000-8000-000000000010";
const docPath = `stock/${vehicleId}/11111111-1111-4111-8111-111111111111.jpg`;
const staffAs = (role: StaffRole) => ({ userId: "00000000-0000-4000-8000-000000000001", displayName: "Test", role, can: (permission: Parameters<typeof can>[1]) => can(role, permission), client }) as never;

async function jpegWithGps() {
  return new Uint8Array(await sharp({ create: { width: 30, height: 20, channels: 3, background: "#258" } }).withMetadata({ orientation: 6, exif: { IFD0: { Make: "Phone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "53/1 31/1 0/1" } } }).jpeg().toBuffer());
}

beforeEach(() => {
  db.tables = { sale_vehicles: [{ id: vehicleId }], vehicle_documents: [] };
  db.objects = new Map();
  db.removed = [];
  db.uploads = [];
  db.insertError = null;
  db.onInsert = null;
  db.folders = {};
});

describe("document finalize", () => {
  it("re-encodes image documents so EXIF and GPS do not survive", async () => {
    db.objects.set(docPath, await jpegWithGps());
    await finalizeUpload(staffAs("owner"), { target: "document", vehicleId, path: docPath, fileName: "v5c.jpg", kind: "registration_document" });
    const stored = db.objects.get(docPath)!;
    const metadata = await sharp(Buffer.from(stored)).metadata();
    expect(metadata.exif).toBeUndefined();
    expect([metadata.width, metadata.height]).toEqual([20, 30]);
    expect(db.tables.vehicle_documents).toHaveLength(1);
    expect(db.tables.vehicle_documents![0]).toMatchObject({ object_path: docPath, content_type: "image/jpeg", size_bytes: stored.byteLength });
  });

  it("keeps PDFs as uploaded after the magic-byte check, and rejects disguised files", async () => {
    const pdfPath = docPath.replace(".jpg", ".pdf");
    const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
    db.objects.set(pdfPath, pdf);
    await finalizeUpload(staffAs("owner"), { target: "document", vehicleId, path: pdfPath, fileName: "report.pdf", kind: "inspection_report" });
    expect(db.uploads).toHaveLength(0);
    expect(db.objects.get(pdfPath)).toEqual(pdf);

    const fake = docPath.replace("1111-1111", "2222-2222");
    db.objects.set(fake, new TextEncoder().encode("<html>not an image"));
    await expect(finalizeUpload(staffAs("owner"), { target: "document", vehicleId, path: fake, fileName: "x.jpg", kind: "other" })).rejects.toThrow(/not a valid/);
    expect(db.removed).toContain(fake);
  });

  it("is idempotent: a retried finalize returns the existing row and never deletes its file", async () => {
    db.objects.set(docPath, await jpegWithGps());
    const first = await finalizeUpload(staffAs("owner"), { target: "document", vehicleId, path: docPath, fileName: "v5c.jpg", kind: "registration_document" });
    const second = await finalizeUpload(staffAs("owner"), { target: "document", vehicleId, path: docPath, fileName: "v5c.jpg", kind: "registration_document" });
    expect(second.id).toBe(first.id);
    expect(db.tables.vehicle_documents).toHaveLength(1);
    expect(db.removed).not.toContain(docPath);
    expect(db.objects.has(docPath)).toBe(true);
  });

  it("returns the row written by a concurrent finalize instead of deleting the file", async () => {
    db.objects.set(docPath, await jpegWithGps());
    db.insertError = { code: "23505" };
    db.onInsert = () => { db.tables.vehicle_documents = [{ id: "doc-raced", object_path: docPath, sale_vehicle_id: vehicleId, seller_submission_id: null }]; };
    const result = await finalizeUpload(staffAs("owner"), { target: "document", vehicleId, path: docPath, fileName: "v5c.jpg", kind: "registration_document" });
    expect(result.id).toBe("doc-raced");
    expect(db.removed).not.toContain(docPath);
  });
});
