import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { retryEnquiryNotifications } from "@/lib/enquiries/repository";
import { isMissingSchemaError } from "@/lib/exchange/schema";
import { EXCHANGE_ENQUIRY_TYPES, isRetryDue, MAX_AUTOMATIC_RETRIES, nextRetryAt, UNSCHEDULED_LOOKBACK_HOURS, type RetryCandidate } from "./retry-policy";

type Client = Pick<SupabaseClient, "from">;
type Sender = (enquiryId: string) => Promise<"sent" | "failed" | string>;

export type SweepResult = { checked: number; retried: number; sent: number; failed: number; stopped: number; skipped: number; schemaMissing: boolean };

const columns = "id,type,notification_status,notification_attempt_count,notification_next_retry_at,created_at";

/**
 * Claims one retry with compare-and-set on the attempt count, so two sweeps
 * (cron and a staff "Retry now") can never send the same notification twice.
 */
async function claim(client: Client, row: RetryCandidate & { id: string }, now: Date) {
  const attempts = row.notification_attempt_count + 1;
  const { data, error } = await client
    .from("enquiries")
    .update({ notification_attempt_count: attempts, notification_next_retry_at: nextRetryAt(attempts, now) })
    .eq("id", row.id)
    .eq("notification_status", "failed")
    .eq("notification_attempt_count", row.notification_attempt_count)
    .select("id");
  return !error && (data || []).length > 0 ? attempts : null;
}

async function attempt(client: Client, row: RetryCandidate & { id: string }, now: Date, send: Sender, result: SweepResult) {
  const attempts = await claim(client, row, now);
  if (attempts === null) {
    result.skipped += 1;
    return;
  }
  result.retried += 1;
  let status: string;
  try {
    status = await send(row.id);
  } catch {
    status = "failed";
    await client.from("enquiries").update({ notification_status: "failed" }).eq("id", row.id);
  }
  if (status === "sent") {
    result.sent += 1;
    await client.from("enquiries").update({ notification_next_retry_at: null }).eq("id", row.id);
  } else {
    result.failed += 1;
    if (attempts >= MAX_AUTOMATIC_RETRIES) result.stopped += 1;
  }
}

/**
 * Retries failed exchange enquiry notifications that are due, at most three
 * times each with backoff (retry-policy.ts). Uses the existing
 * retryEnquiryNotifications path. Safe to run often and concurrently.
 */
export async function runNotificationRetrySweep(client: Client, options: { now?: Date; limit?: number; send?: Sender } = {}): Promise<SweepResult> {
  const now = options.now ?? new Date();
  const send = options.send ?? retryEnquiryNotifications;
  const result: SweepResult = { checked: 0, retried: 0, sent: 0, failed: 0, stopped: 0, skipped: 0, schemaMissing: false };
  const since = new Date(now.getTime() - UNSCHEDULED_LOOKBACK_HOURS * 3_600_000).toISOString();
  const { data, error } = await client
    .from("enquiries")
    .select(columns)
    .eq("notification_status", "failed")
    .in("type", [...EXCHANGE_ENQUIRY_TYPES])
    .is("deleted_at", null)
    .lt("notification_attempt_count", MAX_AUTOMATIC_RETRIES)
    .or(`notification_next_retry_at.lte.${now.toISOString()},and(notification_next_retry_at.is.null,created_at.gte.${since})`)
    .order("created_at")
    .limit(options.limit ?? 25);
  if (error) {
    result.schemaMissing = isMissingSchemaError(error);
    return result;
  }
  for (const row of (data || []) as Array<RetryCandidate & { id: string }>) {
    result.checked += 1;
    if (!isRetryDue(row, now)) {
      result.skipped += 1;
      continue;
    }
    await attempt(client, row, now, send, result);
  }
  return result;
}

/** A staff "Retry now" for one enquiry: ignores the schedule and the automatic cap, still claims safely. */
export async function retryEnquiryNotificationNow(client: Client, enquiryId: string, options: { now?: Date; send?: Sender } = {}) {
  const now = options.now ?? new Date();
  const result: SweepResult = { checked: 1, retried: 0, sent: 0, failed: 0, stopped: 0, skipped: 0, schemaMissing: false };
  const { data, error } = await client.from("enquiries").select(columns).eq("id", enquiryId).is("deleted_at", null).maybeSingle();
  if (error) return { ...result, schemaMissing: isMissingSchemaError(error) };
  const row = data as (RetryCandidate & { id: string }) | null;
  if (!row || row.notification_status !== "failed") return { ...result, skipped: 1 };
  await attempt(client, row, now, options.send ?? retryEnquiryNotifications, result);
  return result;
}

/** Failed exchange notifications for the staff list, newest first. */
export async function listFailedNotifications(client: Client, limit = 20) {
  const { data, error } = await client
    .from("enquiries")
    .select(`${columns},customers(name,anonymised_at)`)
    .eq("notification_status", "failed")
    .in("type", [...EXCHANGE_ENQUIRY_TYPES])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { rows: [], schemaMissing: isMissingSchemaError(error) };
  return { rows: (data || []) as unknown as Array<RetryCandidate & { id: string; customers: { name: string; anonymised_at: string | null } | null }>, schemaMissing: false };
}
