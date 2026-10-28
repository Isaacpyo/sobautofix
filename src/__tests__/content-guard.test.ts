import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { guardCustomerFacingContent, guardExchangeContent } from "@/lib/content-guard";
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
    // Back office, APIs and the SOB Auto Exchange (which may state a used
    // car's MOT expiry as a vehicle fact; see guardExchangeContent) are out
    // of scope. Paths are compared with forward slashes on every platform.
    const excluded = ["src/app/admin", "src/app/api", "src/app/auth", "src/components/admin", "src/app/exchange", "src/components/exchange"];
    const files = roots.flatMap(walk).filter((file) => !excluded.some((part) => relative(process.cwd(), file).split(sep).join("/").startsWith(part)));
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

describe("exchange content guard", () => {
  it("allows a used car's test expiry as a vehicle fact", () => {
    expect(guardExchangeContent(`${forbiddenServiceWord} expires March 2027. Last ${forbiddenServiceWord} passed with no advisories.`)).toEqual({ safe: true });
  });

  it("still rejects offering the test as a service", () => {
    for (const phrase of [`Book an ${forbiddenServiceWord} with us`, `${forbiddenServiceWord} testing centre`, `Service & ${forbiddenServiceWord}`, `${forbiddenServiceWord} prices`]) {
      expect(guardExchangeContent(phrase).safe).toBe(false);
    }
  });
});
