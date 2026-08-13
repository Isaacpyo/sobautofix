import { describe, expect, it } from "vitest";
import { getRecoveryErrorMessage } from "@/lib/auth/recovery-errors";

describe("password recovery error messaging", () => {
  it("gives a safe wait message for Supabase email rate limits", () => {
    expect(getRecoveryErrorMessage({ status: 429, code: "over_email_send_rate_limit" })).toBe(
      "Please wait before requesting another reset email.",
    );
  });

  it("also handles a rate limit when only the HTTP status is available", () => {
    expect(getRecoveryErrorMessage({ status: 429 })).toBe("Please wait before requesting another reset email.");
  });

  it("keeps other operational failures generic", () => {
    expect(getRecoveryErrorMessage({ status: 500, code: "unexpected_failure" })).toBe(
      "We couldn't send the reset email. Please try again shortly.",
    );
    expect(getRecoveryErrorMessage(null)).toBe("We couldn't send the reset email. Please try again shortly.");
  });
});
