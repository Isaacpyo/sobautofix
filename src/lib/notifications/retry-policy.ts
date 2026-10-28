// Bounded retries for exchange enquiry notifications (delivery brief, item 10).
// After the first failure: retry in 15 minutes, then 1 hour, then 6 hours.
// After three retries the enquiry stays "failed" and visible to staff, who
// can still retry by hand.

export const RETRY_DELAYS_MINUTES = [15, 60, 360] as const;
export const MAX_AUTOMATIC_RETRIES = RETRY_DELAYS_MINUTES.length;
/** Failures with no scheduled retry are picked up only if this recent, so old history is never re-sent. */
export const UNSCHEDULED_LOOKBACK_HOURS = 48;
export const EXCHANGE_ENQUIRY_TYPES = ["vehicle_sales", "vehicle_purchase"] as const;

/** When to try again after `attemptsMade` automatic retries, or null to stop. */
export function nextRetryAt(attemptsMade: number, now: Date): string | null {
  if (attemptsMade < 0 || attemptsMade >= MAX_AUTOMATIC_RETRIES) return null;
  const delay = RETRY_DELAYS_MINUTES[attemptsMade] as number;
  return new Date(now.getTime() + delay * 60_000).toISOString();
}

export type RetryCandidate = {
  type: string;
  notification_status: string;
  notification_attempt_count: number;
  notification_next_retry_at: string | null;
  created_at: string;
};

/** Whether the automatic sweep should retry this enquiry now. */
export function isRetryDue(row: RetryCandidate, now: Date) {
  if (!(EXCHANGE_ENQUIRY_TYPES as readonly string[]).includes(row.type)) return false;
  if (row.notification_status !== "failed") return false;
  if (row.notification_attempt_count >= MAX_AUTOMATIC_RETRIES) return false;
  if (row.notification_next_retry_at) return Date.parse(row.notification_next_retry_at) <= now.getTime();
  return Date.parse(row.created_at) >= now.getTime() - UNSCHEDULED_LOOKBACK_HOURS * 3_600_000;
}

export function retryStateLabel(row: Pick<RetryCandidate, "notification_attempt_count" | "notification_next_retry_at">, now = new Date()) {
  if (row.notification_attempt_count >= MAX_AUTOMATIC_RETRIES) return `Stopped after ${MAX_AUTOMATIC_RETRIES} automatic retries`;
  if (!row.notification_next_retry_at) return "Waiting for the next retry run";
  const minutes = Math.round((Date.parse(row.notification_next_retry_at) - now.getTime()) / 60_000);
  if (minutes <= 0) return "Retry due now";
  return minutes < 90 ? `Next retry in about ${minutes} minutes` : `Next retry in about ${Math.round(minutes / 60)} hours`;
}
