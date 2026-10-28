import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Short-lived HMAC token that lets the browser that created a seller
// submission upload its photos (same pattern as src/lib/enquiries/upload-token.ts).
// The scope prefix stops an enquiry attachment token being replayed here.

const SCOPE = "seller-photos";
const LIFETIME_SECONDS = 2 * 60 * 60; // slow mobile connections, retries

function secret() {
  return process.env.SUPABASE_SECRET_KEY || process.env.CRON_SECRET || "local-development-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(`${SCOPE}.${payload}`).digest("base64url");
}

export function createSellerUploadToken(submissionId: string, now = Date.now()) {
  const expires = Math.floor(now / 1000) + LIFETIME_SECONDS;
  const payload = `${submissionId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySellerUploadToken(token: string | null, submissionId: string, now = Date.now()) {
  if (!token) return false;
  const [id, expiresValue, provided] = token.split(".");
  if (!id || !expiresValue || !provided || id !== submissionId) return false;
  const expires = Number(expiresValue);
  if (!Number.isFinite(expires) || expires < now / 1000) return false;
  const expected = Buffer.from(sign(`${id}.${expiresValue}`));
  const given = Buffer.from(provided);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
