import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

const localBuckets = new Map<string, { count: number; resetAt: number }>();

function hashIdentifier(value: string) {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${day}:${value}`).digest("hex");
}

export async function consumeRateLimit(identifier: string, scope: string, limit = 10, windowSeconds = 60) {
  const key = hashIdentifier(identifier);
  const admin = createAdminClient();

  if (admin) {
    const { data, error } = await admin.rpc("consume_rate_limit", {
      identifier_hash: key,
      limit_scope: scope,
      request_limit: limit,
      window_seconds: windowSeconds,
    });
    if (!error && typeof data === "boolean") return data;
  }

  const now = Date.now();
  const compound = `${scope}:${key}`;
  const bucket = localBuckets.get(compound);
  if (!bucket || bucket.resetAt <= now) {
    localBuckets.set(compound, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
