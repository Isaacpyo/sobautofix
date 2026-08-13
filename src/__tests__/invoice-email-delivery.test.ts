import { afterEach, describe, expect, it, vi } from "vitest";
import { approvedInvoiceReplyTo, productionEmailSender } from "@/lib/email/identity";
import {
  classifyTransactionalEmailProviderError,
  getInvoiceResendConfig,
  getResendConfig,
  TransactionalEmailDeliveryError,
  type TransactionalEmail,
} from "@/lib/email/resend";
import {
  deliverInvoiceEmail,
  invoiceEmailPayloadSha256,
  type DeliverInvoiceEmailInput,
  type InvoiceEmailClaimInput,
  type InvoiceEmailClaimResult,
  type InvoiceEmailDeliveryDependencies,
} from "@/lib/invoices/email-delivery";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import type { Invoice } from "@/lib/invoices/types";

const logicalSendId = "5f04ae56-b240-45f0-b984-0d4e1156218f";
const copySendId = "0a08ca3c-4409-4799-957e-6f32cc8a395d";
const invoiceId = "61b6fbaf-21e8-4eb8-92df-0522f11a9474";
const revision = "1";
const timestamp = "2026-08-11T12:00:00.000Z";

describe("invoice email delivery", () => {
  it("includes authoritative HTML in the payload hash", () => {
    const base: TransactionalEmail = { to: "customer@example.com", subject: "Invoice", text: "Invoice attached", html: "<p>Version one</p>" };
    expect(invoiceEmailPayloadSha256(base)).not.toBe(invoiceEmailPayloadSha256({ ...base, html: "<p>Version two</p>" }));
  });

  it.each(["draft", "void"] as const)("rejects a %s invoice before claiming or contacting the provider", async (invoiceStatus) => {
    const dependencies = dependencyHarness();

    await expect(deliverInvoiceEmail(deliveryInput({ invoiceStatus }), dependencies)).rejects.toThrow("ONLY_ISSUED_OR_PAID_INVOICES_CAN_BE_EMAILED");

    expect(dependencies.claim).not.toHaveBeenCalled();
    expect(dependencies.sendEmail).not.toHaveBeenCalled();
  });

  it.each(["issued", "paid"] as const)("delivers a valid %s invoice with the approved identity", async (invoiceStatus) => {
    const dependencies = dependencyHarness();

    await expect(deliverInvoiceEmail(deliveryInput({ invoiceStatus }), dependencies)).resolves.toMatchObject({
      outcome: "sent",
      logicalSendId,
      providerId: "provider-email-1",
    });

    expect(dependencies.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "customer@example.com",
      replyTo: approvedInvoiceReplyTo,
      idempotencyKey: databaseIdempotencyKey(logicalSendId),
      tags: [{ name: "invoice_send_id", value: logicalSendId }],
    }));
  });

  it("does not contact the provider when the database claim fails", async () => {
    const dependencies = dependencyHarness({ claim: vi.fn().mockRejectedValue(new Error("database unavailable")) });

    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).rejects.toThrow("database unavailable");

    expect(dependencies.sendEmail).not.toHaveBeenCalled();
    expect(dependencies.finalizeSent).not.toHaveBeenCalled();
  });

  it.each([
    [{ disposition: "already_sent", providerId: "provider-existing" } as const, "already_sent"],
    [{ disposition: "in_progress" } as const, "in_progress"],
    [{ disposition: "reconciliation_required" } as const, "reconciliation_required"],
  ])("does not resend when claim returns %s", async (claimResult, expectedOutcome) => {
    const dependencies = dependencyHarness({ claim: vi.fn().mockResolvedValue(claimResult) });

    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).resolves.toMatchObject({ outcome: expectedOutcome });

    expect(dependencies.sendEmail).not.toHaveBeenCalled();
    expect(dependencies.finalizeSent).not.toHaveBeenCalled();
  });

  it("reuses one logical id, payload hash, and provider key for a retry", async () => {
    let attempt = 0;
    const claimInputs: Array<Parameters<InvoiceEmailDeliveryDependencies["claim"]>[0]> = [];
    const providerMessages: TransactionalEmail[] = [];
    const dependencies = dependencyHarness({
      claim: vi.fn(async (input) => {
        claimInputs.push(input);
        attempt += 1;
        return {
          disposition: "dispatch" as const,
          claimToken: `claim-${attempt}`,
          attemptId: String(attempt),
          providerIdempotencyKey: databaseIdempotencyKey(input.logicalSendId),
        };
      }),
      sendEmail: vi.fn(async (message) => {
        providerMessages.push(message);
        if (providerMessages.length === 1) throw new TransactionalEmailDeliveryError("rejected", "validation_error", false);
        return { providerId: "provider-email-1" };
      }),
    });

    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).resolves.toMatchObject({ outcome: "failed" });
    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).resolves.toMatchObject({ outcome: "sent", providerId: "provider-email-1" });

    expect(claimInputs).toHaveLength(2);
    expect(claimInputs[0]?.logicalSendId).toBe(logicalSendId);
    expect(claimInputs[1]?.logicalSendId).toBe(logicalSendId);
    expect(claimInputs[0]?.payloadSha256).toBe(claimInputs[1]?.payloadSha256);
    expect(providerMessages[0]?.idempotencyKey).toBe(providerMessages[1]?.idempotencyKey);
  });

  it("uses a distinct provider key for an intentional Send Copy operation", async () => {
    const providerMessages: TransactionalEmail[] = [];
    const dependencies = dependencyHarness({
      sendEmail: vi.fn(async (message) => {
        providerMessages.push(message);
        return { providerId: `provider-${providerMessages.length}` };
      }),
    });

    await deliverInvoiceEmail(deliveryInput(), dependencies);
    await deliverInvoiceEmail(deliveryInput({ logicalSendId: copySendId }), dependencies);

    expect(providerMessages[0]?.idempotencyKey).toBe(databaseIdempotencyKey(logicalSendId));
    expect(providerMessages[1]?.idempotencyKey).toBe(databaseIdempotencyKey(copySendId));
    expect(providerMessages[0]?.idempotencyKey).not.toBe(providerMessages[1]?.idempotencyKey);
  });

  it("records a conclusive provider rejection as failed", async () => {
    const dependencies = dependencyHarness({
      sendEmail: vi.fn().mockRejectedValue(new TransactionalEmailDeliveryError("rejected", "validation_error", false)),
    });

    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).resolves.toEqual({
      outcome: "failed",
      logicalSendId,
      attemptId: "attempt-1",
      errorCode: "validation_error",
      retryable: false,
    });
    expect(dependencies.recordAttemptOutcome).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed", errorCode: "validation_error" }));
    expect(dependencies.finalizeSent).not.toHaveBeenCalled();
  });

  it.each([
    new TransactionalEmailDeliveryError("ambiguous", "application_error", true),
    new Error("socket closed"),
  ])("records an uncertain provider outcome as ambiguous", async (providerError) => {
    const dependencies = dependencyHarness({ sendEmail: vi.fn().mockRejectedValue(providerError) });

    const result = await deliverInvoiceEmail(deliveryInput(), dependencies);

    expect(result).toMatchObject({ outcome: "ambiguous", logicalSendId, stateRecorded: true });
    expect(dependencies.recordAttemptOutcome).toHaveBeenCalledWith(expect.objectContaining({ outcome: "ambiguous" }));
  });

  it("treats a success response without a provider id as ambiguous", async () => {
    const dependencies = dependencyHarness({ sendEmail: vi.fn().mockResolvedValue({ providerId: null }) });

    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).resolves.toMatchObject({
      outcome: "ambiguous",
      errorCode: "missing_provider_id",
      stateRecorded: true,
    });
  });

  it("retries an idempotent sent finalizer without resending", async () => {
    const finalizeSent = vi.fn().mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce(undefined);
    const dependencies = dependencyHarness({ finalizeSent });

    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).resolves.toMatchObject({ outcome: "sent" });

    expect(dependencies.sendEmail).toHaveBeenCalledTimes(1);
    expect(finalizeSent).toHaveBeenCalledTimes(2);
    expect(dependencies.recordAttemptOutcome).not.toHaveBeenCalled();
  });

  it("never marks a provider success as failed when sent-state persistence remains unavailable", async () => {
    const dependencies = dependencyHarness({ finalizeSent: vi.fn().mockRejectedValue(new Error("database unavailable")) });

    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).resolves.toEqual({
      outcome: "ambiguous",
      logicalSendId,
      attemptId: "attempt-1",
      errorCode: "sent_persistence_failed",
      retryable: true,
      stateRecorded: true,
    });
    expect(dependencies.sendEmail).toHaveBeenCalledTimes(1);
    expect(dependencies.recordAttemptOutcome).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "ambiguous",
      providerId: "provider-email-1",
    }));
  });

  it("reports unrecorded ambiguity if all post-send persistence is unavailable", async () => {
    const dependencies = dependencyHarness({
      finalizeSent: vi.fn().mockRejectedValue(new Error("database unavailable")),
      recordAttemptOutcome: vi.fn().mockRejectedValue(new Error("database unavailable")),
    });

    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).resolves.toEqual({
      outcome: "ambiguous",
      logicalSendId,
      attemptId: "attempt-1",
      errorCode: "attempt_persistence_failed",
      retryable: false,
      stateRecorded: false,
    });
    expect(dependencies.sendEmail).toHaveBeenCalledTimes(1);
    expect(dependencies.finalizeSent).toHaveBeenCalledTimes(2);
  });

  it("surfaces outcome-persistence failure as unrecorded ambiguity", async () => {
    const dependencies = dependencyHarness({
      sendEmail: vi.fn().mockRejectedValue(new TransactionalEmailDeliveryError("rejected", "validation_error", false)),
      recordAttemptOutcome: vi.fn().mockRejectedValue(new Error("database unavailable")),
    });

    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).resolves.toEqual({
      outcome: "ambiguous",
      logicalSendId,
      attemptId: "attempt-1",
      errorCode: "attempt_persistence_failed",
      retryable: false,
      stateRecorded: false,
    });
  });

  it("rejects an invalid idempotency key returned by the claim adapter", async () => {
    const dependencies = dependencyHarness({
      claim: vi.fn().mockResolvedValue({
        disposition: "dispatch",
        claimToken: "claim-1",
        attemptId: "attempt-1",
        providerIdempotencyKey: "invalid key with spaces",
      }),
    });

    await expect(deliverInvoiceEmail(deliveryInput(), dependencies)).rejects.toThrow("INVALID_INVOICE_EMAIL_IDEMPOTENCY_KEY");
    expect(dependencies.sendEmail).not.toHaveBeenCalled();
  });
});

describe("invoice email configuration", () => {
  const originalEnvironment = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,
    ENQUIRY_NOTIFICATION_EMAIL: process.env.ENQUIRY_NOTIFICATION_EMAIL,
  };

  afterEach(() => {
    restoreEnvironment(originalEnvironment);
  });

  it("requires the exact approved Reply-To for invoices without changing enquiry configuration", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = productionEmailSender;
    process.env.RESEND_REPLY_TO = "another-valid-address@example.com";
    process.env.ENQUIRY_NOTIFICATION_EMAIL = "notifications@example.com";

    expect(getResendConfig()?.replyTo).toBe("another-valid-address@example.com");
    expect(getInvoiceResendConfig()).toBeNull();

    process.env.RESEND_REPLY_TO = approvedInvoiceReplyTo;
    expect(getInvoiceResendConfig()?.replyTo).toBe(approvedInvoiceReplyTo);
  });
});

describe("Resend outcome classification", () => {
  it.each([
    [{ name: "application_error", statusCode: null }, "ambiguous"],
    [{ name: "internal_server_error", statusCode: 503 }, "ambiguous"],
    [{ name: "concurrent_idempotent_requests", statusCode: 409 }, "ambiguous"],
    [{ name: "validation_error", statusCode: 400 }, "rejected"],
    [{ name: "invalid_idempotent_request", statusCode: 409 }, "ambiguous"],
  ] as const)("classifies provider result %o as %s", (providerError, expectedKind) => {
    expect(classifyTransactionalEmailProviderError(providerError)).toMatchObject({ kind: expectedKind, code: providerError.name });
  });

  it("marks a conclusive rate-limit rejection as safe to retry with the same logical send", () => {
    expect(classifyTransactionalEmailProviderError({ name: "rate_limit_exceeded", statusCode: 429 })).toMatchObject({
      kind: "rejected",
      retryable: true,
    });
  });

  it("requires reconciliation when a key was previously used with a different payload", () => {
    expect(classifyTransactionalEmailProviderError({ name: "invalid_idempotent_request", statusCode: 409 })).toMatchObject({
      kind: "ambiguous",
      retryable: false,
    });
  });
});

describe("invoice email PDF stability", () => {
  it("renders byte-identical PDFs for one immutable invoice revision", async () => {
    const invoice = representativeInvoice();

    const first = await renderInvoicePdf(invoice);
    const second = await renderInvoicePdf(invoice);

    expect(first.equals(second)).toBe(true);
  }, 20_000);
});

function deliveryInput(overrides: Partial<DeliverInvoiceEmailInput> = {}): DeliverInvoiceEmailInput {
  return {
    logicalSendId,
    invoiceId,
    invoiceRevision: revision,
    invoiceStatus: "issued",
    recipient: " Customer@Example.com ",
    subject: "Invoice SOB-2026-000001 from SOB Autofix",
    text: "Please find your invoice attached.",
    html: "<p>Please find your invoice attached.</p>",
    attachment: { filename: "SOB-Invoice-SOB-2026-000001.pdf", content: Buffer.from("stable-pdf-content") },
    ...overrides,
  };
}

function dependencyHarness(overrides: Partial<InvoiceEmailDeliveryDependencies> = {}): InvoiceEmailDeliveryDependencies {
  const claim: InvoiceEmailDeliveryDependencies["claim"] = vi.fn(async (input: InvoiceEmailClaimInput): Promise<InvoiceEmailClaimResult> => ({
    disposition: "dispatch",
    claimToken: "claim-1",
    attemptId: "attempt-1",
    providerIdempotencyKey: databaseIdempotencyKey(input.logicalSendId),
  }));
  return {
    claim,
    finalizeSent: vi.fn().mockResolvedValue(undefined),
    recordAttemptOutcome: vi.fn().mockResolvedValue(undefined),
    sendEmail: vi.fn().mockResolvedValue({ providerId: "provider-email-1" }),
    ...overrides,
  };
}

function databaseIdempotencyKey(sendId: string) {
  return `invoice-db/${sendId}`;
}

function restoreEnvironment(environment: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function representativeInvoice(): Invoice {
  return {
    id: invoiceId,
    invoice_number: "SOB-2026-000001",
    invoice_year: 2026,
    invoice_sequence: 1,
    revision: 1,
    status: "issued",
    source_type: "manual",
    booking_id: null,
    enquiry_id: null,
    customer_id: null,
    vehicle_id: null,
    replaces_invoice_id: null,
    currency: "GBP",
    customer_name: "Test Customer",
    customer_email: "customer@example.com",
    customer_phone: null,
    customer_address: "1 Test Street, Doncaster",
    vehicle_registration: "AB12CDE",
    vehicle_make: "BMW",
    vehicle_model: "320d",
    service_name: "Diagnostics",
    appointment_start: null,
    issuer_legal_name: "SOB Autofix Limited",
    issuer_trading_name: "SOB Autofix",
    issuer_tagline: "Professional Diagnostics. Not Guesswork.",
    issuer_address: "Cumbrae\nStation Road\nNorton\nDoncaster\nDN6 9HF\nUnited Kingdom",
    issuer_email: "sobautofix@gmail.com",
    issuer_phone: "07469273483",
    issuer_company_number: "16182532",
    issue_date: "2026-08-11",
    due_date: "2026-08-18",
    subtotal_pence: 8500,
    discount_pence: 0,
    tax_pence: 0,
    total_pence: 8500,
    notes: null,
    payment_terms: "Payment due within 7 days.",
    issued_at: timestamp,
    paid_at: null,
    payment_method: null,
    payment_reference: null,
    voided_at: null,
    created_by: null,
    updated_by: null,
    created_at: timestamp,
    updated_at: timestamp,
    invoice_items: [{
      id: "item-1",
      description: "Diagnostics",
      quantity: "1.000",
      unit_price_pence: 8500,
      line_total_pence: 8500,
      position: 0,
    }],
  };
}
