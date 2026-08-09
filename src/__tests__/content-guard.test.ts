import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { guardCustomerFacingContent } from "@/lib/content-guard";
import { diagnostics, mainNavigation, services, siteConfig } from "@/config/site";
import { legalContent, topLevelContent } from "@/config/landing-content";

const forbiddenServiceWord = ["M", "O", "T"].join("");

describe("customer-facing content guard", () => {
  it("accepts approved seeded content", () => {
    expect(guardCustomerFacingContent({ siteConfig, services, diagnostics, mainNavigation, topLevelContent, legalContent })).toEqual({ safe: true });
  });

  it("rejects a prohibited standalone service term", () => {
    const result = guardCustomerFacingContent(`Book an ${forbiddenServiceWord} appointment`);
    expect(result.safe).toBe(false);
  });

  it("finds no prohibited terms in rendered-source directories", () => {
    const roots = [join(process.cwd(), "src", "app"), join(process.cwd(), "src", "components"), join(process.cwd(), "src", "config")];
    const excluded = ["src\\app\\admin", "src\\app\\api", "src\\app\\auth", "src\\components\\admin"];
    const files = roots.flatMap(walk).filter((file) => !excluded.some((part) => relative(process.cwd(), file).startsWith(part)));
    const offenders = files.filter((file) => new RegExp(`\\b${forbiddenServiceWord}\\b`, "i").test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}
