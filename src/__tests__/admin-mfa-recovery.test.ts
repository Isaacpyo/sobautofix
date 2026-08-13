import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  rpc: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(), set: harness.cookieSet })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({ rpc: harness.rpc }),
}));
vi.mock("@/lib/auth/trusted-device-server", () => ({
  clearTrustedDeviceCookie: vi.fn(async () => undefined),
}));

import {
  generateMfaRecoveryCodeSet,
  hashMfaRecoveryCode,
  isMfaRecoveryCode,
  MFA_RECOVERY_CODE_COUNT,
  MFA_RECOVERY_COOKIE_OPTIONS,
} from "@/lib/auth/mfa-recovery";
import { consumeMfaRecoveryCode, createMfaRecoveryCodeSet } from "@/lib/auth/mfa-recovery-server";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("administrator MFA recovery", () => {
  beforeEach(() => {
    harness.rpc.mockReset();
    harness.cookieSet.mockReset();
  });

  it("generates ten unique human-readable codes with 100 bits of entropy each", () => {
    const codes = generateMfaRecoveryCodeSet();
    expect(codes).toHaveLength(MFA_RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(MFA_RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){4}$/);
      expect(isMfaRecoveryCode(code)).toBe(true);
    }
  });

  it("hashes normalized codes and never passes plaintext to PostgreSQL", async () => {
    const code = "2345-6789-ABCD-EFGH-JKLM";
    const hash = hashMfaRecoveryCode(code);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("2345");
    expect(hashMfaRecoveryCode(code.toLowerCase().replaceAll("-", " "))).toBe(hash);
    harness.rpc.mockResolvedValue({ data: true, error: null });
    await expect(consumeMfaRecoveryCode("admin-id", code)).resolves.toBe(true);
    expect(harness.rpc).toHaveBeenCalledWith("consume_admin_mfa_recovery_code", expect.objectContaining({
      p_user_id: "admin-id",
      p_code_hash: hash,
      p_session_token_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(JSON.stringify(harness.rpc.mock.calls)).not.toContain(code);
    expect(harness.cookieSet).toHaveBeenCalledWith(
      "sob_admin_mfa_recovery",
      expect.stringMatching(/^[0-9a-f]{64}$/),
      MFA_RECOVERY_COOKIE_OPTIONS,
    );
  });

  it("stores only ten hashes when a new code set is created", async () => {
    harness.rpc.mockResolvedValue({ data: 10, error: null });
    const codes = await createMfaRecoveryCodeSet("admin-id", "mfa_recovery_codes_created");
    expect(codes).toHaveLength(10);
    const call = harness.rpc.mock.calls[0];
    expect(call?.[0]).toBe("replace_admin_mfa_recovery_codes");
    expect(call?.[1]).toMatchObject({
      p_user_id: "admin-id",
      p_event_action: "mfa_recovery_codes_created",
      p_code_hashes: expect.arrayContaining([expect.stringMatching(/^[0-9a-f]{64}$/)]),
    });
    expect((call?.[1] as { p_code_hashes: string[] }).p_code_hashes).toHaveLength(10);
    for (const code of codes || []) expect(JSON.stringify(call)).not.toContain(code);
  });

  it("fails invalid, used, or revoked codes without exposing which condition failed", async () => {
    await expect(consumeMfaRecoveryCode("admin-id", "not-a-code")).resolves.toBe(false);
    expect(harness.rpc).not.toHaveBeenCalled();
    harness.rpc.mockResolvedValue({ data: false, error: null });
    await expect(consumeMfaRecoveryCode("admin-id", "2345-6789-ABCD-EFGH-JKLM")).resolves.toBe(false);
    expect(harness.cookieSet).not.toHaveBeenCalled();
  });

  it("uses one guarded UPDATE as the atomic single-use boundary", () => {
    const migration = read("supabase", "migrations", "202608130008_admin_mfa_recovery.sql");
    expect(migration).toMatch(/update public\.admin_mfa_recovery_codes\s+set used_at = now\(\)\s+where user_id = p_user_id[\s\S]+and code_hash = p_code_hash[\s\S]+and used_at is null[\s\S]+and revoked_at is null[\s\S]+returning id into l_code_id;/i);
    expect(migration).not.toMatch(/select id[\s\S]+from public\.admin_mfa_recovery_codes[\s\S]+set used_at/i);
  });

  it("cannot report two successes when concurrent database consumption accepts only one", async () => {
    harness.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    const code = "2345-6789-ABCD-EFGH-JKLM";
    const results = await Promise.all([
      consumeMfaRecoveryCode("admin-id", code),
      consumeMfaRecoveryCode("admin-id", code),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(harness.cookieSet).toHaveBeenCalledTimes(1);
  });

  it("revokes old sets, active recovery sessions, and trusted devices on regeneration", () => {
    const migration = read("supabase", "migrations", "202608130008_admin_mfa_recovery.sql");
    expect(migration).toContain("set revoked_at = now()\n  where user_id = p_user_id and used_at is null and revoked_at is null");
    expect(migration).toContain("update public.admin_mfa_recovery_sessions");
    expect(migration).toContain("update public.admin_trusted_devices");
    const actions = read("src", "app", "admin", "(protected)", "configuration", "security", "actions.ts");
    expect(actions).toContain("const admin = await getAdminUser();");
    expect(actions).toContain("if (!admin?.mfaVerified)");
  });

  it("keeps all recovery storage and RPCs behind the service role", () => {
    const migration = read("supabase", "migrations", "202608130008_admin_mfa_recovery.sql");
    for (const table of ["admin_mfa_recovery_codes", "admin_mfa_recovery_sessions", "admin_mfa_policy"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
    expect(migration).toContain("grant execute on function public.consume_admin_mfa_recovery_code(uuid, text, text, timestamptz) to service_role");
    expect(migration).not.toMatch(/grant (select|insert|update|delete)[^;]+to (anon|authenticated)/i);
  });

  it("keeps factor replacement controlled until a new genuine TOTP reaches AAL2", () => {
    const actions = read("src", "app", "admin", "mfa", "recover", "actions.ts");
    expect(actions.indexOf("challengeAndVerify")).toBeLessThan(actions.indexOf("auth.admin.mfa.deleteFactor"));
    expect(actions).toContain('assurance?.currentLevel !== "aal2"');
    expect(actions).toContain("recovery.old_factor_ids");
    expect(actions).toContain('auth.signOut({ scope: "global" })');
    expect(actions).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("does not let an email recovery session enter factor or recovery-code management", () => {
    const recovery = read("src", "app", "admin", "mfa", "recover", "actions.ts");
    const security = read("src", "app", "admin", "(protected)", "configuration", "security", "actions.ts");
    const server = read("src", "lib", "supabase", "server.ts");
    expect(recovery).toContain("consumeMfaRecoveryCode");
    expect(security).toContain("const admin = await getAdminUser();");
    expect(server).toContain("if (requireMfa && requiresMfaChallenge(assurance) && !trustedDevice) return null");
    expect(server).toContain("if (requireMfa && mandatoryMfa && !mfaRequired && !mfaVerified) return null");
  });

  it("ships mandatory MFA disabled and provides enrollment-only routing for later activation", () => {
    const migration = read("supabase", "migrations", "202608130008_admin_mfa_recovery.sql");
    expect(migration).toContain("mandatory_mfa_enabled boolean not null default false");
    expect(migration).toContain("values (true, false)");
    expect(read("src", "proxy.ts")).toContain('enrollmentUrl.pathname = "/admin/mfa/enroll"');
    expect(read("src", "app", "admin", "mfa", "enroll", "page.tsx")).toContain("No enquiries, invoices, bookings, inventory or configuration data is available here.");
  });
});
