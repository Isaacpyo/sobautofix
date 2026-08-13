import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: authMocks })) }));
vi.mock("@/config/site", () => ({ siteConfig: { siteUrl: "https://sobautofix.com" } }));

import { GET, POST } from "@/app/auth/confirm/route";

const recoveryUrl = "https://sobautofix.com/auth/confirm?token_hash=hashed-token&type=recovery&next=/admin/reset-password";

function recoveryPost(overrides: Record<string, string> = {}, origin = "https://sobautofix.com") {
  const values = { token_hash: "hashed-token", type: "recovery", next: "/admin/reset-password", ...overrides };
  return new NextRequest("https://sobautofix.com/auth/confirm", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin },
    body: new URLSearchParams(values),
  });
}

function proxiedRecoveryPost() {
  return new NextRequest("https://internal-deployment.vercel.app/auth/confirm", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://sobautofix.com" },
    body: new URLSearchParams({ token_hash: "hashed-token", type: "recovery", next: "/admin/reset-password" }),
  });
}

describe("recovery auth confirmation callback", () => {
  beforeEach(() => {
    authMocks.exchangeCodeForSession.mockReset();
    authMocks.verifyOtp.mockReset();
  });

  it("does not consume a recovery token on GET", async () => {
    const response = await GET(new NextRequest(recoveryUrl));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin");
    expect(await response.text()).toContain("Continue securely");
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("does not consume a token when a scanner repeats GET", async () => {
    await GET(new NextRequest(recoveryUrl));
    await GET(new NextRequest(recoveryUrl));
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("verifies a recovery token only after a same-origin POST", async () => {
    authMocks.verifyOtp.mockResolvedValue({ error: null });
    const response = await POST(recoveryPost());
    expect(authMocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "hashed-token", type: "recovery" });
    expect(response.headers.get("location")).toBe("https://sobautofix.com/admin/reset-password");
  });

  it("accepts the canonical production origin behind a proxy deployment host", async () => {
    authMocks.verifyOtp.mockResolvedValue({ error: null });
    const response = await POST(proxiedRecoveryPost());
    expect(authMocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "hashed-token", type: "recovery" });
    expect(response.headers.get("location")).toBe("https://sobautofix.com/admin/reset-password");
  });

  it("rejects a missing token, invalid type, and unsafe destination", async () => {
    const invalidValues: Array<Record<string, string>> = [{ token_hash: "" }, { type: "invalid" }, { next: "https://evil.example" }];
    for (const values of invalidValues) {
      const response = await POST(recoveryPost(values));
      expect(response.headers.get("location")).toBe("https://sobautofix.com/admin/login?error=invalid-link");
    }
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("rejects cross-origin POSTs without attempting verification", async () => {
    const response = await POST(recoveryPost({}, "https://evil.example"));
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://sobautofix.com/admin/login?error=invalid-link");
  });

  it("handles failed Supabase verification as an invalid link", async () => {
    authMocks.verifyOtp.mockResolvedValue({ error: new Error("expired token") });
    const response = await POST(recoveryPost());
    expect(response.headers.get("location")).toBe("https://sobautofix.com/admin/login?error=invalid-link");
  });

  it("rejects a GET without a token or code", async () => {
    const response = await GET(new NextRequest("https://sobautofix.com/auth/confirm?next=/admin/reset-password"));
    expect(authMocks.verifyOtp).not.toHaveBeenCalled();
    expect(authMocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://sobautofix.com/admin/login?error=invalid-link");
  });
});
