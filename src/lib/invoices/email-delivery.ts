import "server-only";

import { createHash } from "node:crypto";
import { approvedInvoiceReplyTo, parseEmailAddress, productionEmailSender } from "@/lib/email/identity";
import {
  sendInvoiceTransactionalEmail,
  TransactionalEmailDeliveryError,
  type TransactionalEmail,
} from "@/lib/email/resend";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InvoiceEmailClaimInput = {
  logicalSendId: string;
  invoiceId: string;
  invoiceRevision: string;
  invoiceStatus: "issued" | "paid";
  recipient: string;
  payloadSha256: string;
};

export type InvoiceEmailClaimResult =
  | { disposition: "dispatch"; claimToken: string; attemptId: string; providerIdempotencyKey: string }
  | { disposition: "already_sent"; providerId: string | null }
  | { disposition: "in_progress" }
  | { disposition: "reconciliation_required" };

export type InvoiceEmailAttemptOutcome = {
  logicalSendId: string;
  attemptId: string;
  claimToken: string;
  outcome: "failed" | "ambiguous";
  errorCode: string;
  providerId?: string;
};

export type InvoiceEmailDeliveryDependencies = {
  /** Atomically reserves one physical attempt for this logical send before any provider call. */
  claim: (input: InvoiceEmailClaimInput) => Promise<InvoiceEmailClaimResult>;
  /** Must be transactional and idempotent: persist sent state and its audit event together. */
  finalizeSent: (input: {
    logicalSendId: string;
    attemptId: string;
    claimToken: string;
    providerId: string;
  }) => Promise<void>;
  /** Persists a conclusive rejection or an uncertain outcome without changing a sent row. */
  recordAttemptOutcome: (input: InvoiceEmailAttemptOutcome) => Promise<void>;
  sendEmail?: (message: TransactionalEmail) => Promise<{ providerId: string | null }>;
};

export type DeliverInvoiceEmailInput = {
  logicalSendId: string;
  invoiceId: string;
  invoiceRevision: string | number;
  invoiceStatus: "draft" | "issued" | "paid" | "void";
  recipient: string;
  subject: string;
  text: string;
  html: string;
  attachment: { filename: string; content: Buffer };
};

export type InvoiceEmailDeliveryResult =
  | { outcome: "sent"; logicalSendId: string; attemptId: string; providerId: string }
  | { outcome: "already_sent"; logicalSendId: string; providerId: string | null }
  | { outcome: "in_progress"; logicalSendId: string }
  | { outcome: "reconciliation_required"; logicalSendId: string }
  | { outcome: "failed"; logicalSendId: string; attemptId: string; errorCode: string; retryable: boolean }
  | { outcome: "ambiguous"; logicalSendId: string; attemptId: string; errorCode: string; retryable: boolean; stateRecorded: boolean };

export async function deliverInvoiceEmail(
  input: DeliverInvoiceEmailInput,
  dependencies: InvoiceEmailDeliveryDependencies,
): Promise<InvoiceEmailDeliveryResult> {
  const normalized = normalizeInput(input);
  const message: TransactionalEmail = {
    to: normalized.recipient,
    subject: normalized.subject,
    text: normalized.text,
    html: normalized.html,
    replyTo: approvedInvoiceReplyTo,
    tags: [{ name: "invoice_send_id", value: normalized.logicalSendId }],
    attachments: [normalized.attachment],
  };
  const payloadSha256 = invoiceEmailPayloadSha256(message);
  const claim = await dependencies.claim({
    logicalSendId: normalized.logicalSendId,
    invoiceId: normalized.invoiceId,
    invoiceRevision: normalized.invoiceRevision,
    invoiceStatus: normalized.invoiceStatus,
    recipient: normalized.recipient,
    payloadSha256,
  });

  if (claim.disposition === "already_sent") {
    return { outcome: "already_sent", logicalSendId: normalized.logicalSendId, providerId: claim.providerId };
  }
  if (claim.disposition === "in_progress") {
    return { outcome: "in_progress", logicalSendId: normalized.logicalSendId };
  }
  if (claim.disposition === "reconciliation_required") {
    return { outcome: "reconciliation_required", logicalSendId: normalized.logicalSendId };
  }
  const providerIdempotencyKey = validateProviderIdempotencyKey(claim.providerIdempotencyKey);

  const providerMessage = { ...message, idempotencyKey: providerIdempotencyKey };
  let providerId: string | null;
  try {
    providerId = (await (dependencies.sendEmail ?? sendWithApprovedInvoiceIdentity)(providerMessage)).providerId;
  } catch (error) {
    const failure = classifyProviderError(error);
    return persistFailure(dependencies, normalized.logicalSendId, claim, failure);
  }

  if (!providerId) {
    return persistFailure(dependencies, normalized.logicalSendId, claim, {
      outcome: "ambiguous",
      errorCode: "missing_provider_id",
      retryable: true,
    });
  }

  const finalizeInput = {
    logicalSendId: normalized.logicalSendId,
    attemptId: claim.attemptId,
    claimToken: claim.claimToken,
    providerId,
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await dependencies.finalizeSent(finalizeInput);
      return {
        outcome: "sent",
        logicalSendId: normalized.logicalSendId,
        attemptId: claim.attemptId,
        providerId,
      };
    } catch {
      // The finalizer is idempotent. A second call resolves a committed write whose response was lost.
    }
  }

  return persistFailure(dependencies, normalized.logicalSendId, claim, {
    outcome: "ambiguous",
    errorCode: "sent_persistence_failed",
    retryable: true,
    providerId,
  });
}

export function invoiceEmailPayloadSha256(message: TransactionalEmail) {
  const hash = createHash("sha256");
  const manifest = JSON.stringify([
    productionEmailSender,
    approvedInvoiceReplyTo,
    message.to,
    message.subject,
    message.text,
    message.html ?? null,
    message.headers ?? null,
    message.tags ?? null,
    message.attachments?.map((attachment) => attachment.filename) ?? [],
  ]);
  hash.update(manifest, "utf8");
  for (const attachment of message.attachments ?? []) {
    hash.update("\0", "utf8");
    hash.update(attachment.content);
  }
  return hash.digest("hex");
}

async function sendWithApprovedInvoiceIdentity(message: TransactionalEmail) {
  const result = await sendInvoiceTransactionalEmail(message);
  return { providerId: result.data?.id ?? null };
}

async function persistFailure(
  dependencies: InvoiceEmailDeliveryDependencies,
  logicalSendId: string,
  claim: Extract<InvoiceEmailClaimResult, { disposition: "dispatch" }>,
  failure: { outcome: "failed" | "ambiguous"; errorCode: string; retryable: boolean; providerId?: string },
): Promise<InvoiceEmailDeliveryResult> {
  try {
    await dependencies.recordAttemptOutcome({
      logicalSendId,
      attemptId: claim.attemptId,
      claimToken: claim.claimToken,
      outcome: failure.outcome,
      errorCode: failure.errorCode,
      providerId: failure.providerId,
    });
  } catch {
    return {
      outcome: "ambiguous",
      logicalSendId,
      attemptId: claim.attemptId,
      errorCode: "attempt_persistence_failed",
      retryable: false,
      stateRecorded: false,
    };
  }

  if (failure.outcome === "failed") {
    return {
      outcome: "failed",
      logicalSendId,
      attemptId: claim.attemptId,
      errorCode: failure.errorCode,
      retryable: failure.retryable,
    };
  }
  return {
    outcome: "ambiguous",
    logicalSendId,
    attemptId: claim.attemptId,
    errorCode: failure.errorCode,
    retryable: failure.retryable,
    stateRecorded: true,
  };
}

function classifyProviderError(error: unknown) {
  if (error instanceof TransactionalEmailDeliveryError) {
    return {
      outcome: error.kind === "rejected" ? "failed" as const : "ambiguous" as const,
      errorCode: error.code,
      retryable: error.retryable,
    };
  }
  return { outcome: "ambiguous" as const, errorCode: "provider_outcome_unknown", retryable: true };
}

function normalizeInput(input: DeliverInvoiceEmailInput) {
  if (input.invoiceStatus !== "issued" && input.invoiceStatus !== "paid") {
    throw new Error("ONLY_ISSUED_OR_PAID_INVOICES_CAN_BE_EMAILED");
  }
  const recipient = parseEmailAddress(input.recipient.trim()).toLowerCase();
  const logicalSendId = normalizeUuid(input.logicalSendId, "logical send ID");
  const invoiceId = normalizeUuid(input.invoiceId, "invoice ID");
  const suppliedRevision = String(input.invoiceRevision).trim();
  if (!/^\d+$/.test(suppliedRevision) || BigInt(suppliedRevision) < 1n) throw new Error("INVALID_INVOICE_REVISION");
  const invoiceRevision = BigInt(suppliedRevision).toString();
  if (!input.subject.trim() || !input.text.trim() || !input.html.trim()) throw new Error("INVALID_INVOICE_EMAIL_CONTENT");
  if (!input.attachment.filename.trim() || input.attachment.content.length === 0) throw new Error("INVALID_INVOICE_ATTACHMENT");
  return {
    ...input,
    logicalSendId,
    invoiceId,
    invoiceRevision,
    recipient,
    invoiceStatus: input.invoiceStatus,
  } as const;
}

function normalizeUuid(value: string, label: string) {
  const normalized = value.trim().toLowerCase();
  if (!uuidPattern.test(normalized)) throw new Error(`Invalid ${label}.`);
  return normalized;
}

function validateProviderIdempotencyKey(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 256 || /\s|[^\x21-\x7e]/.test(normalized)) {
    throw new Error("INVALID_INVOICE_EMAIL_IDEMPOTENCY_KEY");
  }
  return normalized;
}
