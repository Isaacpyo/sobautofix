// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { qrCode } = vi.hoisted(() => ({
  qrCode: "data:image/svg+xml;utf-8,<svg xmlns='http://www.w3.org/2000/svg'><rect width='1' height='1'/></svg>",
}));

vi.mock("@/app/admin/(protected)/configuration/security/actions", () => ({
  startMfaEnrollment: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  startMfaReplacement: vi.fn(),
  verifyMfaReplacement: vi.fn(),
  removeMfaFactor: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useActionState: vi.fn().mockReturnValue([
      { message: "", enrollment: { factorId: "test-factor", qrCode, secret: "TESTSETUPKEY" } },
      vi.fn(),
      false,
    ]),
  };
});

import { MfaSecurityPanel } from "@/app/admin/(protected)/configuration/security/mfa-security-panel";

describe("admin MFA QR rendering", () => {
  it("preserves Supabase's complete data URI on a normal image element", () => {
    render(<MfaSecurityPanel />);
    const image = screen.getByRole("img", { name: "QR code for SOB Autofix admin authenticator setup" });
    expect(image.tagName).toBe("IMG");
    expect(image.getAttribute("src")).toBe(qrCode);
    expect(image.getAttribute("src")).not.toContain("data%3Aimage");
    expect(image).not.toHaveAttribute("srcset");
  });
});
