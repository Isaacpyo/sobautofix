import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  getAdminUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  consumeRateLimit: vi.fn(),
  createClient: vi.fn(),
  revokeAllTrustedDevices: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: harness.redirect }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ "x-forwarded-for": "192.0.2.1" })) }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: harness.consumeRateLimit }));
vi.mock("@/lib/auth/trusted-device-server", () => ({
  getCurrentTrustedDevice: vi.fn(),
  revokeAllTrustedDevices: harness.revokeAllTrustedDevices,
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
  createClient: harness.createClient,
  getAdminUser: harness.getAdminUser,
}));

import { loginWithPassword, resetAdminPassword } from "@/app/admin/login/actions";
import ResetPasswordPage from "@/app/admin/reset-password/page";

function passwordForm() {
  const formData = new FormData();
  formData.set("password", "a-strong-new-password");
  formData.set("confirmPassword", "a-strong-new-password");
  return formData;
}

function adminAt(
  currentLevel: "aal1" | "aal2",
  method: "password" | "recovery" | "otp",
  nextLevel: "aal1" | "aal2" = currentLevel,
) {
  return {
    user: { id: "admin-id", email: "sobautofix@gmail.com" },
    profile: { user_id: "admin-id", display_name: "Admin" },
    assurance: {
      currentLevel,
      nextLevel,
      currentAuthenticationMethods: [{ method }],
    },
    client: { auth: { updateUser: harness.updateUser, signOut: harness.signOut } },
  };
}

describe("admin password reset authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.updateUser.mockResolvedValue({ error: null });
    harness.signOut.mockResolvedValue({ error: null });
    harness.consumeRateLimit.mockResolvedValue(true);
    harness.revokeAllTrustedDevices.mockResolvedValue(true);
  });

  it("throttles password attempts before calling Supabase Auth", async () => {
    harness.consumeRateLimit.mockResolvedValueOnce(false);
    const formData = new FormData();
    formData.set("email", "sobautofix@gmail.com");
    formData.set("password", "guessed-password");
    await expect(loginWithPassword({ message: "" }, formData)).resolves.toEqual({
      message: "Sign-in failed. Check your details and try again.",
    });
    expect(harness.createClient).not.toHaveBeenCalled();
  });

  it("denies anonymous and ordinary AAL1 direct action calls", async () => {
    harness.getAdminUser.mockResolvedValueOnce(null);
    await expect(resetAdminPassword({ message: "" }, passwordForm())).resolves.toEqual({
      message: "This reset link is invalid or has expired. Request a new link.",
    });

    harness.getAdminUser.mockResolvedValueOnce(adminAt("aal1", "password"));
    await expect(resetAdminPassword({ message: "" }, passwordForm())).resolves.toEqual({
      message: "This reset link is invalid or has expired. Request a new link.",
    });
    expect(harness.updateUser).not.toHaveBeenCalled();
  });

  it("preserves the reset destination through a genuine MFA step-up", async () => {
    harness.getAdminUser.mockResolvedValue(adminAt("aal1", "otp", "aal2"));

    await expect(ResetPasswordPage()).rejects.toThrow(
      "NEXT_REDIRECT:/admin/mfa?returnTo=%2Fadmin%2Freset-password&stepUp=1",
    );
    expect(harness.getAdminUser).toHaveBeenCalledWith({ requireMfa: false });
  });

  it("does not let an ordinary AAL1 session open the reset form", async () => {
    harness.getAdminUser.mockResolvedValue(adminAt("aal1", "password"));

    await expect(ResetPasswordPage()).rejects.toThrow(
      "NEXT_REDIRECT:/admin/login?error=invalid-link",
    );
  });

  it("renders the reset form after the MFA session reaches AAL2", async () => {
    harness.getAdminUser.mockResolvedValue(adminAt("aal2", "otp", "aal2"));

    await expect(ResetPasswordPage()).resolves.toBeTruthy();
  });

  it("allows a genuine recovery session and invalidates remembered access", async () => {
    harness.getAdminUser.mockResolvedValue(adminAt("aal1", "recovery"));
    await expect(resetAdminPassword({ message: "" }, passwordForm())).rejects.toThrow(
      "NEXT_REDIRECT:/admin/login?reset=success",
    );
    expect(harness.updateUser).toHaveBeenCalledWith({ password: "a-strong-new-password" });
    expect(harness.revokeAllTrustedDevices).toHaveBeenCalledWith(
      "admin-id",
      "mfa_trusted_devices_revoked_password_change",
    );
    expect(harness.signOut).toHaveBeenCalled();
  });

  it("allows a current AAL2 administrator session", async () => {
    harness.getAdminUser.mockResolvedValue(adminAt("aal2", "password"));
    await expect(resetAdminPassword({ message: "" }, passwordForm())).rejects.toThrow(
      "NEXT_REDIRECT:/admin/login?reset=success",
    );
    expect(harness.updateUser).toHaveBeenCalledOnce();
  });
});
