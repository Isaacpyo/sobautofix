# SOB Auto Exchange: operations

## Environment variables (names only; values live in Vercel)

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_EXCHANGE_URL` | Production | `https://exchange.sobautofix.com`. Canonical URLs, links from the main site, host detection. Leave unset on previews. |
| `EXCHANGE_REDIRECTS_ENABLED` | Production | `true` only after the exchange host serves HTTPS. Permanently redirects `/cars-for-sale[/slug]` and `/exchange/*` to the exchange host. |
| Existing: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`, `ENQUIRY_NOTIFICATION_EMAIL`, `ENQUIRY_REPLY_DOMAIN`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `CRON_SECRET`, `SENTRY_DSN`, `VEHICLE_*` | All | Reused unchanged. Exchange notifications go to the recipients in Settings, falling back to `ENQUIRY_NOTIFICATION_EMAIL`. |

## Release order

1. **Back up**: confirm Supabase backups/PITR are current for project `nmebkkelpvhxxycrbbos`.
2. **Migrations** (additive; the current production code keeps working with them):
   ```bash
   supabase link --project-ref nmebkkelpvhxxycrbbos
   supabase migration list --linked
   supabase db push --linked --dry-run   # expect exactly 20261028090000, 20261028090100, 20261028090200
   supabase db push --linked
   ```
   Verify: `select count(*) from public.exchange_settings;` returns 1, and `/admin/exchange` no longer shows "needs its database update".
3. **Code**: merging to `main` deploys production through Vercel. The app also runs safely before step 2; the new sections show a "database update needed" state.
4. **Smoke test**: `https://sobautofix.com/exchange` (noindex fallback), `/cars-for-sale`, `/admin/exchange`, `/admin/diary`, a viewing request and a seller submission addressed to a Vitalos test inbox, then close both test records.
5. **Exchange host** (needs DNS on the Cloudflare zone `sobautofix.com` and the Vercel project):
   - Vercel → project `sobautofix` → Settings → Domains → add `exchange.sobautofix.com`.
   - Cloudflare → DNS → add `CNAME exchange → cname.vercel-dns.com`, **DNS only** (grey cloud) so Vercel issues the certificate.
   - Wait until Vercel shows the domain as valid, then set `NEXT_PUBLIC_EXCHANGE_URL=https://exchange.sobautofix.com` and redeploy.
   - Check `https://exchange.sobautofix.com/`, `/cars`, `/robots.txt`, `/sitemap.xml`.
   - Set `EXCHANGE_REDIRECTS_ENABLED=true` and redeploy; check that `/cars-for-sale/<slug>` redirects (308).
   - Add `https://exchange.sobautofix.com/sitemap.xml` in Google Search Console.
6. **Content**: in Admin → Vehicle Buying & Selling → Settings, add the approved policy wording, notification recipients and any response-time promise. Empty fields show an honest "being finalised" message.

## Rollback

- **Code**: revert the merge commit on `main` (or promote the previous Vercel deployment). The schema is additive, so the previous code runs against it unchanged.
- **Redirects**: set `EXCHANGE_REDIRECTS_ENABLED=false` and redeploy; the main-site stock pages serve again immediately.
- **Schema** (only if the feature is abandoned): take `supabase db dump` first, then drop the new tables (`diary_appointments`, `vehicle_sales`, `vehicle_documents`, `vehicle_inspections`, `seller_submission_photos`, `seller_submissions`, `vehicle_prep_items`, `vehicle_costs`, `vehicle_internal_records`, `exchange_private_settings`, `exchange_settings`) and functions. The added columns and enum values are harmless and can stay.

## Retention

The signed daily cron (`/api/cron/retention`, `vercel.json`) removes files through the Storage API, then finalises rows:

- Ordinary enquiries closed for 12 months: attachments removed; customers anonymised if they have no bookings, sales, purchased cars or recent appointments.
- Seller submissions declined or closed for the configured period (default 12 months, Settings): photos, submission-only documents, registration, fault and damage notes and postcode removed. Purchased submissions are business records and are kept.

Before the first production run after the migration, run a dry run and record the counts:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://sobautofix.com/api/cron/retention?dryRun=1"
```

The previous retention job deleted from `storage.objects` directly, which Supabase now refuses, so earlier runs failed without removing anything. Expect the first real run to catch up on the backlog.

## Monitoring

- Sentry captures server errors from exchange pages and APIs (existing `SENTRY_DSN`).
- Notification failures show in Admin → Vehicle Buying & Selling → Overview with a retry, and in Admin → Notifications.
- `/api/health` is unchanged.
