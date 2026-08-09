import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_EMAIL, isAllowedAdminEmail } from "@/config/admin";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "202608090001_restrict_admin_email.sql"),
  "utf8",
);

describe("single administrator identity", () => {
  it("allows only the configured SOB Autofix email", () => {
    expect(ADMIN_EMAIL).toBe("sobautofix@gmail.com");
    expect(isAllowedAdminEmail("SOBAutofix@gmail.com")).toBe(true);
    expect(isAllowedAdminEmail("another@example.com")).toBe(false);
    expect(isAllowedAdminEmail(undefined)).toBe(false);
  });

  it("enforces the same identity in database authorization", () => {
    expect(migration).toContain("create or replace function public.is_admin()");
    expect(migration).toContain("lower(coalesce(auth_user.email, '')) = 'sobautofix@gmail.com'");
    expect(migration).toContain("create trigger enforce_single_admin_email");
  });
});
