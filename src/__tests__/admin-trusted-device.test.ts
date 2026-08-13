import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findValidTrustedDevice,
  generateTrustedDeviceToken,
  hashTrustedDeviceToken,
  isSensitiveAdminPath,
  TRUSTED_DEVICE_COOKIE_OPTIONS,
  TRUSTED_DEVICE_LIFETIME_SECONDS,
} from "@/lib/auth/trusted-device";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

function clientReturning(data: Record<string, unknown> | null) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data, error: null }),
  };
  return { from: () => query } as never;
}

function failingClient() {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: new Error("database unavailable") }) };
  return { from: () => query } as never;
}

async function recordFor(token: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "device-id",
    user_id: "admin-id",
    token_hash: await hashTrustedDeviceToken(token),
    device_label: "Chrome on Windows",
    user_agent_summary: "Chrome on Windows",
    created_at: "2026-08-13T08:00:00.000Z",
    last_used_at: "2026-08-13T08:00:00.000Z",
    expires_at: "2026-08-20T08:00:00.000Z",
    revoked_at: null,
    ...overrides,
  };
}

describe("admin trusted devices", () => {
  it("uses a high-entropy token, hashes it, and configures a seven-day secure cookie", async () => {
    const token = generateTrustedDeviceToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashTrustedDeviceToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(TRUSTED_DEVICE_LIFETIME_SECONDS).toBe(604800);
    expect(TRUSTED_DEVICE_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 604800 });
  });

  it("accepts only a matching, active record for the authenticated user and fails closed", async () => {
    const token = "a".repeat(64);
    const device = await findValidTrustedDevice(clientReturning(await recordFor(token)), "admin-id", token, { now: new Date("2026-08-14T08:00:00Z"), touch: false });
    expect(device?.id).toBe("device-id");
    expect(await findValidTrustedDevice(clientReturning(await recordFor(token, { user_id: "other-admin" })), "admin-id", token, { touch: false })).toBeNull();
    expect(await findValidTrustedDevice(clientReturning(await recordFor(token, { revoked_at: "2026-08-14T00:00:00Z" })), "admin-id", token, { touch: false })).toBeNull();
    expect(await findValidTrustedDevice(clientReturning(await recordFor(token, { expires_at: "2026-08-13T09:00:00Z" })), "admin-id", token, { now: new Date("2026-08-14T08:00:00Z"), touch: false })).toBeNull();
    expect(await findValidTrustedDevice(clientReturning(null), "admin-id", "invalid", { touch: false })).toBeNull();
    expect(await findValidTrustedDevice(failingClient(), "admin-id", token, { touch: false })).toBeNull();
    expect(await findValidTrustedDevice(clientReturning(await recordFor(token)), "admin-id", undefined, { touch: false })).toBeNull();
  });

  it("always treats Security as a genuine MFA step-up path", () => {
    expect(isSensitiveAdminPath("/admin/configuration/security")).toBe(true);
    expect(isSensitiveAdminPath("/admin/enquiries")).toBe(false);
  });

  it("creates trust only after successful TOTP verification and leaves mutations on real AAL2", () => {
    const challenge = read("src", "app", "admin", "mfa", "actions.ts");
    expect(challenge.indexOf("challengeAndVerify")).toBeLessThan(challenge.indexOf("await trustCurrentDevice"));
    expect(challenge).toContain('formData.get("trustDevice") === "yes"');
    expect(read("src", "app", "admin", "(protected)", "actions.ts")).toContain("safeAdminReturnTo");
    expect(read("src", "app", "admin", "mfa", "page.tsx")).toContain('query.stepUp !== "1"');
    expect(read("src", "proxy.ts")).toContain("isSensitiveAdminPath(pathname)");
    expect(read("src", "app", "admin", "(protected)", "invoices", "actions.ts")).toContain("requireFreshAdminSession");
    expect(read("src", "app", "admin", "(protected)", "news", "import-actions.ts")).toContain("requireFreshAdminSession");
  });

  it("revokes trust before password and factor changes", () => {
    const loginActions = read("src", "app", "admin", "login", "actions.ts");
    expect(loginActions.indexOf("revokeAllTrustedDevices(user.id")).toBeLessThan(loginActions.indexOf("auth.updateUser"));
    const securityActions = read("src", "app", "admin", "(protected)", "configuration", "security", "actions.ts");
    expect(securityActions.indexOf('"mfa_trusted_devices_revoked_factor_removed"')).toBeLessThan(securityActions.lastIndexOf("auth.mfa.unenroll"));
  });

  it("stores only token hashes in a server-only table", () => {
    const migration = read("supabase", "migrations", "202608130007_admin_trusted_devices.sql");
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.admin_trusted_devices from public, anon, authenticated");
    expect(migration).not.toMatch(/raw_token|otpauth|mfa_secret/i);
  });
});
