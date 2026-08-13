import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const MFA_RECOVERY_CODE_COUNT = 10;
export const MFA_RECOVERY_CODE_CHARACTERS = 20;
export const MFA_RECOVERY_SESSION_SECONDS = 15 * 60;
export const MFA_RECOVERY_COOKIE = "sob_admin_mfa_recovery";
export const MFA_RECOVERY_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/admin/mfa/recover",
  maxAge: MFA_RECOVERY_SESSION_SECONDS,
};

// Exactly 32 symbols makes each independently sampled character worth 5 bits.
// Twenty characters therefore carry 100 bits of entropy before formatting.
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateMfaRecoveryCode() {
  const bytes = randomBytes(MFA_RECOVERY_CODE_CHARACTERS);
  const compact = Array.from(bytes, (byte) => alphabet[byte & 31]).join("");
  return compact.match(/.{1,4}/g)?.join("-") ?? compact;
}

export function generateMfaRecoveryCodeSet() {
  const codes = new Set<string>();
  while (codes.size < MFA_RECOVERY_CODE_COUNT) codes.add(generateMfaRecoveryCode());
  return [...codes];
}

export function normalizeMfaRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

export function isMfaRecoveryCode(value: string) {
  const normalized = normalizeMfaRecoveryCode(value);
  return normalized.length === MFA_RECOVERY_CODE_CHARACTERS
    && [...normalized].every((character) => alphabet.includes(character));
}

export function hashMfaRecoveryCode(value: string) {
  return createHash("sha256").update(normalizeMfaRecoveryCode(value), "utf8").digest("hex");
}

export function generateMfaRecoverySessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashMfaRecoverySessionToken(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

