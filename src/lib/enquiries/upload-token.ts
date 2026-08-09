import { createHmac, timingSafeEqual } from "node:crypto";

const lifetimeSeconds = 15 * 60;

function secret() {
  return process.env.SUPABASE_SECRET_KEY || process.env.CRON_SECRET || "local-development-secret";
}

export function createUploadToken(enquiryId: string) {
  const expires = Math.floor(Date.now() / 1000) + lifetimeSeconds;
  const payload = `${enquiryId}.${expires}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyUploadToken(token: string | null, enquiryId: string) {
  if (!token) return false;
  const [id, expiresValue, provided] = token.split(".");
  if (!id || !expiresValue || !provided || id !== enquiryId) return false;
  const expires = Number(expiresValue);
  if (!Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  const expected = createHmac("sha256", secret()).update(`${id}.${expiresValue}`).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
