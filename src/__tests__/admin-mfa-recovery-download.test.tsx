// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatMfaRecoveryCodesDownload, RecoveryCodeDisplay } from "@/app/admin/(protected)/configuration/security/recovery-codes-panel";

vi.mock("@/app/admin/(protected)/configuration/security/actions", () => ({
  regenerateMfaRecoveryCodes: vi.fn(),
}));

describe("MFA recovery-code download", () => {
  it("formats a plain-text file without changing the codes", () => {
    const text = formatMfaRecoveryCodesDownload(["FIRST-CODE", "SECOND-CODE"]);

    expect(text).toContain("01. FIRST-CODE");
    expect(text).toContain("02. SECOND-CODE");
    expect(text).toContain("Each code can be used once");
  });

  it("downloads the one-time codes as a local text file", () => {
    const createObjectURL = vi.fn(() => "blob:recovery-codes");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<RecoveryCodeDisplay codes={["FIRST-CODE", "SECOND-CODE"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Download codes (.txt)" }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:recovery-codes");
    click.mockRestore();
  });

  it("offers a way back to the Security page", () => {
    render(<RecoveryCodeDisplay codes={["FIRST-CODE"]} />);

    expect(screen.getByRole("button", { name: "Back to Security" })).toBeVisible();
  });
});
