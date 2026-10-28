import { NextRequest, NextResponse } from "next/server";
import { getExchangePrivateSettings } from "@/lib/exchange/settings";
import { isMissingSchemaError } from "@/lib/exchange/schema";
import { cleanupStagedStockPhotos } from "@/lib/exchange/admin/staging-cleanup";
import { runNotificationRetrySweep } from "@/lib/notifications/retry-sweep";
import { createAdminClient } from "@/lib/supabase/server";

// Signed daily retention job (vercel.json). Supabase Storage refuses direct
// deletes from storage.objects, so files are removed through the Storage
// API first and the database rows are finalised afterwards. Add ?dryRun=1
// to report what would be removed without changing anything.
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  // Ordinary enquiries: closed for 12 months.
  const { data: attachmentRows, error: attachmentError } = await admin.rpc("enquiry_retention_attachment_paths");
  const legacySchema = isMissingSchemaError(attachmentError);
  if (attachmentError && !legacySchema) return NextResponse.json({ error: "Retention task failed" }, { status: 500 });
  const attachmentPaths = ((attachmentRows || []) as Array<{ object_path: string }>).map((row) => row.object_path);

  // Seller submissions: closed or declined for the configured period.
  const { sellerRetentionMonths } = await getExchangePrivateSettings();
  const { data: sellerRows, error: sellerError } = await admin.rpc("exchange_retention_candidates", { p_months: sellerRetentionMonths });
  if (sellerError && !isMissingSchemaError(sellerError)) return NextResponse.json({ error: "Retention task failed" }, { status: 500 });
  const sellerCandidates = (sellerRows || []) as Array<{ submission_id: string; photo_paths: string[]; document_paths: string[] }>;

  if (dryRun) {
    const stagedPhotos = await cleanupStagedStockPhotos({ dryRun: true, storage: admin.storage }).catch(() => null);
    return NextResponse.json({
      stagedPhotos: stagedPhotos?.expired ?? null,
      success: true,
      dryRun: true,
      enquiryAttachments: attachmentPaths.length,
      sellerSubmissions: sellerCandidates.length,
      sellerFiles: sellerCandidates.reduce((total, row) => total + row.photo_paths.length + row.document_paths.length, 0),
    });
  }

  if (attachmentPaths.length) {
    const { error } = await admin.storage.from("enquiry-attachments").remove(attachmentPaths);
    if (error) return NextResponse.json({ error: "Retention task failed" }, { status: 500 });
  }
  const { data: anonymised, error } = await admin.rpc("apply_enquiry_retention");
  if (error) return NextResponse.json({ error: "Retention task failed" }, { status: 500 });

  let sellerSubmissions = 0;
  for (const candidate of sellerCandidates) {
    if (candidate.photo_paths.length) {
      const { error: photoError } = await admin.storage.from("seller-submission-photos").remove(candidate.photo_paths);
      if (photoError) continue;
    }
    if (candidate.document_paths.length) {
      const { error: documentError } = await admin.storage.from("vehicle-documents").remove(candidate.document_paths);
      if (documentError) continue;
    }
    const { data: finalised } = await admin.rpc("finalise_exchange_retention", { p_submission_id: candidate.submission_id });
    if (finalised) sellerSubmissions += 1;
  }

  // ---------------------------------------------------------------------------
  // Separate step: retry failed exchange enquiry notifications (at most three
  // times each, with backoff; see src/lib/notifications/retry-policy.ts).
  // Vercel Hobby allows only daily crons, so it runs here. A failure in this
  // step never fails the retention job above.
  // ---------------------------------------------------------------------------
  let notificationRetries: Awaited<ReturnType<typeof runNotificationRetrySweep>> | { error: string };
  try {
    notificationRetries = await runNotificationRetrySweep(admin);
  } catch {
    notificationRetries = { error: "Notification retry step failed" };
  }

  // Separate step: abandoned staff photo uploads older than 24 hours.
  const stagedPhotos = await cleanupStagedStockPhotos({ storage: admin.storage }).catch(() => ({ error: "Staging cleanup failed" }));

  return NextResponse.json({ success: true, anonymisedRecords: anonymised, sellerSubmissions, sellerCandidates: sellerCandidates.length, notificationRetries, stagedPhotos });
}
