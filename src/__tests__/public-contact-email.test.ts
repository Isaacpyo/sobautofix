import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import { contactLinks } from "@/config/site";
import { approvedInvoiceReplyTo, productionEmailSender } from "@/lib/email/identity";

describe("public contact email separation", () => {
  it("publishes the domain address while retaining protected delivery identities", () => {
    expect(siteConfig.email).toBe("info@sobautofix.com");
    expect(contactLinks.email).toBe("mailto:info@sobautofix.com");
    expect(productionEmailSender).toBe("SOB Autofix <notifications@sobautofix.com>");
    expect(approvedInvoiceReplyTo).toBe("info@sobautofix.com");
  });

  it("updates production public settings conditionally and preserves invoice history", () => {
    const migration = readFileSync("supabase/migrations/202608130006_public_contact_email.sql", "utf8");
    expect(migration).toContain("begin;");
    expect(migration).toContain("value->>'email' = 'sobautofix@gmail.com'");
    expect(migration).toContain("alter column issuer_email set default 'info@sobautofix.com'");
    expect(migration).not.toMatch(/update\s+public\.invoices/i);
    expect(migration).not.toMatch(/delete|truncate|drop\s+(?:table|column)/i);
    expect(migration).toContain("commit;");
  });

  it("keeps routing, sender and masked-reply configuration unchanged", () => {
    const env = readFileSync(".env.example", "utf8");
    expect(env).toContain("RESEND_FROM_EMAIL=SOB Autofix <notifications@sobautofix.com>");
    expect(env).toContain("RESEND_REPLY_TO=sobautofix@gmail.com");
    expect(env).toContain("ENQUIRY_NOTIFICATION_EMAIL=sobautofix@gmail.com");
    expect(env).toContain("ENQUIRY_REPLY_DOMAIN=reply.sobautofix.com");
  });
});
