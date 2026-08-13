import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  user: { id: "admin-id" } as { id: string } | null,
  assurance: { currentLevel: "aal1", nextLevel: "aal1" } as { currentLevel: string; nextLevel: string },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: harness.user } })),
      mfa: { getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: harness.assurance })) },
    },
  }),
}));

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("admin MFA proxy enforcement", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
    harness.user = { id: "admin-id" };
    harness.assurance = { currentLevel: "aal1", nextLevel: "aal1" };
  });

  it("allows a direct protected request when no MFA factor is enrolled", async () => {
    const response = await proxy(new NextRequest("http://localhost/admin/enquiries"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("blocks direct protected access until the enrolled factor is verified", async () => {
    harness.assurance = { currentLevel: "aal1", nextLevel: "aal2" };
    const response = await proxy(new NextRequest("http://localhost/admin/enquiries?status=new"));
    expect(response.headers.get("location")).toBe("http://localhost/admin/mfa?returnTo=%2Fadmin%2Fenquiries%3Fstatus%3Dnew");
  });

  it("allows direct protected access after MFA verification", async () => {
    harness.assurance = { currentLevel: "aal2", nextLevel: "aal2" };
    const response = await proxy(new NextRequest("http://localhost/admin/enquiries"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect the challenge page into a loop", async () => {
    harness.assurance = { currentLevel: "aal1", nextLevel: "aal2" };
    const response = await proxy(new NextRequest("http://localhost/admin/mfa"));
    expect(response.headers.get("location")).toBeNull();
  });
});
