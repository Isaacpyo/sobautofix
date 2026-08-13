import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isSixDigitMfaCode, requiresMfaChallenge, safeAdminReturnTo } from "@/lib/auth/mfa";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("admin TOTP MFA", () => {
  it("allows AAL1 when no verified factor exists", () => {
    expect(requiresMfaChallenge({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
  });

  it("requires a challenge for an enrolled factor at AAL1", () => {
    expect(requiresMfaChallenge({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
  });

  it("allows an MFA-verified AAL2 session", () => {
    expect(requiresMfaChallenge({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
  });

  it("accepts only six numeric digits", () => {
    expect(isSixDigitMfaCode("123456")).toBe(true);
    expect(isSixDigitMfaCode(" 123456 ")).toBe(true);
    expect(isSixDigitMfaCode("12345")).toBe(false);
    expect(isSixDigitMfaCode("12345a")).toBe(false);
  });

  it("allows only local admin return paths", () => {
    expect(safeAdminReturnTo("/admin/enquiries?status=new")).toBe("/admin/enquiries?status=new");
    expect(safeAdminReturnTo("https://evil.example/admin")).toBe("/admin");
    expect(safeAdminReturnTo("//evil.example/admin")).toBe("/admin");
    expect(safeAdminReturnTo("/admin/mfa")).toBe("/admin");
  });

  it("implements enrollment, challenge, removal and route enforcement", () => {
    const securityActions = read("src", "app", "admin", "(protected)", "configuration", "security", "actions.ts");
    const challengeAction = read("src", "app", "admin", "mfa", "actions.ts");
    const protectedLayout = read("src", "app", "admin", "(protected)", "layout.tsx");
    const proxy = read("src", "proxy.ts");
    expect(securityActions).toContain("auth.mfa.enroll");
    expect(securityActions).toContain("challengeAndVerify");
    expect(securityActions).toContain("auth.mfa.unenroll");
    expect(challengeAction).toContain("That verification code is incorrect or has expired.");
    expect(protectedLayout).toContain("getAdminUser({ allowTrustedDevice: true })");
    expect(proxy).toContain('challengeUrl.pathname = "/admin/mfa"');
    expect(read("src", "lib", "supabase", "server.ts")).toContain("const profileClient = createAdminClient()");
  });

  it("does not persist authenticator secrets in application storage", () => {
    const securityActions = read("src", "app", "admin", "(protected)", "configuration", "security", "actions.ts");
    expect(securityActions).not.toContain('from("mfa');
    expect(securityActions).not.toContain('from("site_settings").insert');
    expect(securityActions).not.toContain("console.");
  });

  it("enforces AAL2 in database authorization after MFA enrollment", () => {
    const migration = read("supabase", "migrations", "202608130001_require_mfa_for_enrolled_admin.sql");
    expect(migration).toContain("auth.mfa_factors");
    expect(migration).toContain("factor.status = 'verified'");
    expect(migration).toContain("auth.jwt() ->> 'aal'");
    expect(migration).toContain("= 'aal2'");
  });
});
