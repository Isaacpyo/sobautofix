import { describe, expect, it } from "vitest";
import { formatRegistration, normalizeRegistration, registrationSchema } from "@/lib/vehicle/registration";

describe("vehicle registration", () => {
  it("normalizes whitespace, punctuation and case", () => {
    expect(normalizeRegistration(" ab12-cde ")).toBe("AB12CDE");
  });

  it("formats the final three characters as a plate group", () => {
    expect(formatRegistration("AB12CDE")).toBe("AB12 CDE");
  });

  it("rejects implausible input", () => {
    expect(registrationSchema.safeParse("?").success).toBe(false);
    expect(registrationSchema.safeParse("ABCDEFGHI").success).toBe(false);
  });
});
