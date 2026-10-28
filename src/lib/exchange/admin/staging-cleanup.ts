import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { STAGING_BUCKET, STAGING_PREFIX } from "./uploads";

const PAGE = 1000;
const REMOVE_BATCH = 100;

type StorageApi = NonNullable<ReturnType<typeof createAdminClient>>["storage"];
type Listed = { name: string; id: string | null; created_at?: string | null };

export type StagingCleanupResult = { scanned: number; expired: number; removed: number; failed: number; dryRun: boolean };

/**
 * Removes abandoned staff photo uploads from the private staging area
 * (vehicle-documents/staging/stock-photos/<vehicleId>/<file>). A photo stays
 * there only between the signed upload and finalize, which re-encodes it and
 * deletes the staged copy, so anything older than the cut-off was abandoned.
 * Uses the Storage API (Supabase refuses direct deletes from storage.objects).
 * Called from the daily retention cron; pass dryRun to count without deleting.
 */
export async function cleanupStagedStockPhotos(options: { now?: Date; maxAgeHours?: number; dryRun?: boolean; storage?: StorageApi } = {}): Promise<StagingCleanupResult> {
  const storage = options.storage ?? createAdminClient()?.storage;
  if (!storage) throw new Error("Storage is not configured");
  const cutoff = (options.now ?? new Date()).getTime() - (options.maxAgeHours ?? 24) * 3_600_000;
  const bucket = storage.from(STAGING_BUCKET);

  async function listAll(prefix: string) {
    const entries: Listed[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await bucket.list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error("Staged uploads could not be listed");
      entries.push(...((data || []) as Listed[]));
      if (!data || data.length < PAGE) return entries;
    }
  }

  const expired: string[] = [];
  let scanned = 0;
  const consider = (path: string, entry: Listed) => {
    scanned += 1;
    const created = entry.created_at ? new Date(entry.created_at).getTime() : Number.NaN;
    if (Number.isFinite(created) && created < cutoff) expired.push(path);
  };
  for (const entry of await listAll(STAGING_PREFIX)) {
    // Folders (one per vehicle) have no id; files directly under the prefix do.
    if (entry.id) consider(`${STAGING_PREFIX}/${entry.name}`, entry);
    else for (const file of await listAll(`${STAGING_PREFIX}/${entry.name}`)) if (file.id) consider(`${STAGING_PREFIX}/${entry.name}/${file.name}`, file);
  }

  let removed = 0;
  let failed = 0;
  if (!options.dryRun) {
    for (let index = 0; index < expired.length; index += REMOVE_BATCH) {
      const batch = expired.slice(index, index + REMOVE_BATCH);
      const { error } = await bucket.remove(batch);
      if (error) failed += batch.length;
      else removed += batch.length;
    }
  }
  return { scanned, expired: expired.length, removed, failed, dryRun: Boolean(options.dryRun) };
}
