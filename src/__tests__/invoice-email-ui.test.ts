import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sendInvoiceSchema } from "@/lib/invoices/schema";

const invoiceId = "61b6fbaf-21e8-4eb8-92df-0522f11a9474";
const logicalSendId = "5f04ae56-b240-45f0-b984-0d4e1156218f";
const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

describe("invoice email action inputs", () => {
  it.each(["new", "retry"] as const)("requires a stable logical send ID for %s", (intent) => {
    expect(sendInvoiceSchema.safeParse({ invoiceId, recipient: "customer@example.com", intent, logicalSendId }).success).toBe(true);
    expect(sendInvoiceSchema.safeParse({ invoiceId, recipient: "customer@example.com", intent, logicalSendId: "" }).success).toBe(false);
  });
});

describe("invoice email history wiring", () => {
  const page = read("src", "app", "admin", "(protected)", "invoices", "[id]", "page.tsx");
  const actions = read("src", "app", "admin", "(protected)", "invoices", "actions.ts");
  const repository = read("src", "lib", "invoices", "repository.ts");

  it("submits a page-generated ID for a new send and reuses the stored ID only for failed retries", () => {
    expect(page).toContain('name="logicalSendId" value={logicalSendId}');
    expect(page).toContain('emailSend.status === "failed"');
    expect(page).toContain("String(emailSend.invoice_revision) === String(invoice.revision)");
    expect(page).toContain("emailSend.document_status === invoice.status");
    expect(page).toContain('name="logicalSendId" value={emailSend.id}');
    expect(page).toContain('name="intent" value="retry"');
    expect(actions).toContain("sendInvoiceEmail(parsed.invoiceId, parsed.recipient, parsed.logicalSendId)");
    expect(actions).not.toContain("randomUUID");
  });

  it("blocks automatic retry for pending and ambiguous sends", () => {
    expect(page).toContain('emailSend.status === "ambiguous"');
    expect(page).toContain("Reconciliation required; automatic retry is disabled.");
    expect(page).toContain('emailSend.status === "pending"');
    expect(page).toContain("Processing; retry is disabled.");
    expect(page).toContain("Payment and void actions are temporarily unavailable while an email send is in progress.");
  });

  it("loads safe send history and preserves a known provider id on ambiguous persistence", () => {
    expect(repository).toContain('.from("invoice_email_sends")');
    expect(repository).toContain("p_provider_id: providerId || null");
  });
});
