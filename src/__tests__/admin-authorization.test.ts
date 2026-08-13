import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  user: null as { id: string; email?: string } | null,
  profile: null as { user_id: string; display_name: string } | null,
  assurance: { currentLevel: "aal1", nextLevel: "aal1", currentAuthenticationMethods: [{ method: "password" }] },
  assuranceError: null as Error | null,
  cookie: undefined as string | undefined,
  trustedRecord: null as Record<string, unknown> | null,
  policy: null as { mandatory_mfa_enabled: boolean } | null,
  policyError: null as Error | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => harness.cookie ? { value: harness.cookie } : undefined,
    getAll: () => [],
    set: vi.fn(),
  })),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: harness.user } })),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: harness.assurance,
          error: harness.assuranceError,
        })),
      },
    },
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        update: () => query,
        is: () => query,
        maybeSingle: async () => ({
          data: table === "admin_profiles" ? harness.profile : table === "admin_mfa_policy" ? harness.policy : harness.trustedRecord,
          error: table === "admin_mfa_policy" ? harness.policyError : null,
        }),
      };
      return query;
    },
  }),
}));

import { hashTrustedDeviceToken } from "@/lib/auth/trusted-device";
import { getAdminUser } from "@/lib/supabase/server";

describe("admin authorization boundary", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable";
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    harness.user = { id: "admin-id", email: "sobautofix@gmail.com" };
    harness.profile = { user_id: "admin-id", display_name: "Admin" };
    harness.assurance = {
      currentLevel: "aal1",
      nextLevel: "aal1",
      currentAuthenticationMethods: [{ method: "password" }],
    };
    harness.assuranceError = null;
    harness.cookie = undefined;
    harness.trustedRecord = null;
    harness.policy = { mandatory_mfa_enabled: false };
    harness.policyError = null;
  });

  it("denies logged-out, wrong-email, and unprofiled users", async () => {
    harness.user = null;
    await expect(getAdminUser()).resolves.toBeNull();

    harness.user = { id: "other-id", email: "customer@example.com" };
    await expect(getAdminUser()).resolves.toBeNull();

    harness.user = { id: "admin-id", email: "sobautofix@gmail.com" };
    harness.profile = null;
    await expect(getAdminUser()).resolves.toBeNull();
  });

  it("documents the no-factor AAL1 case and enforces enrolled MFA", async () => {
    await expect(getAdminUser()).resolves.toMatchObject({ user: { id: "admin-id" }, mfaVerified: false });

    harness.assurance = {
      currentLevel: "aal1",
      nextLevel: "aal2",
      currentAuthenticationMethods: [{ method: "password" }],
    };
    await expect(getAdminUser()).resolves.toBeNull();
    await expect(getAdminUser({ requireMfa: false })).resolves.toMatchObject({ mfaRequired: true, mfaVerified: false });
  });

  it("restricts an unenrolled administrator once mandatory MFA is activated", async () => {
    harness.policy = { mandatory_mfa_enabled: true };
    await expect(getAdminUser()).resolves.toBeNull();
    await expect(getAdminUser({ requireMfa: false })).resolves.toMatchObject({
      mandatoryMfa: true,
      mfaState: "enrollment_required",
    });
  });

  it("fails closed when the mandatory-MFA policy cannot be read", async () => {
    harness.policyError = new Error("policy unavailable");
    await expect(getAdminUser()).resolves.toBeNull();
    await expect(getAdminUser({ requireMfa: false })).resolves.toMatchObject({
      mandatoryMfa: true,
      mfaState: "enrollment_required",
    });
  });

  it("allows AAL2 but rejects an invalid trusted-device credential", async () => {
    harness.assurance = {
      currentLevel: "aal2",
      nextLevel: "aal2",
      currentAuthenticationMethods: [{ method: "password" }, { method: "totp" }],
    };
    await expect(getAdminUser()).resolves.toMatchObject({ mfaVerified: true });

    harness.assurance = {
      currentLevel: "aal1",
      nextLevel: "aal2",
      currentAuthenticationMethods: [{ method: "password" }],
    };
    harness.cookie = "malformed";
    await expect(getAdminUser({ allowTrustedDevice: true })).resolves.toBeNull();
  });

  it("accepts a valid remembered device only when that bypass is explicitly enabled", async () => {
    const token = "a".repeat(64);
    harness.assurance = {
      currentLevel: "aal1",
      nextLevel: "aal2",
      currentAuthenticationMethods: [{ method: "password" }],
    };
    harness.cookie = token;
    harness.trustedRecord = {
      id: "device-id",
      user_id: "admin-id",
      token_hash: await hashTrustedDeviceToken(token),
      device_label: "Chrome on Windows",
      user_agent_summary: null,
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
    };

    await expect(getAdminUser()).resolves.toBeNull();
    await expect(getAdminUser({ allowTrustedDevice: true })).resolves.toMatchObject({
      trustedDevice: { id: "device-id" },
      mfaVerified: false,
    });
  });
});
