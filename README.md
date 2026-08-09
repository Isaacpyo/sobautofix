# SOB Autofix

Production-oriented Next.js 16 website and structured CMS for SOB Autofix Limited. The public site prioritises vehicle diagnostics, electrical fault finding, mobile mechanic requests, core repairs, inspections, recovery, fleet work and vehicle sales.

## Requirements

- Node.js 22
- pnpm 10.12.1
- A Supabase project for database, authentication and storage
- The external service credentials listed in `.env.example`

## Local setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The marketing site builds without external credentials so approved copy can be reviewed locally. Integration routes fail closed or show an honest unavailable state. `/api/health` returns `503 configuration_required` until every production dependency is present.

## Database and staff access

1. Link the Supabase CLI to the intended staging project.
2. Apply `supabase/migrations/202608080001_initial_schema.sql`.
3. Apply `supabase/seed.sql` for the editable full-service offer.
4. Invite each staff user through Supabase Auth.
5. Insert the invited user ID into `public.admin_profiles` as shown in `supabase/seed.sql`.
6. Configure the three storage buckets and policies through the migration; do not expose `SUPABASE_SECRET_KEY` to the browser.

The CMS is available at `/admin/login`. There is no public staff signup. Administrators can manage structured content, authenticated previews, scheduled publication, revision rollback, search fields, offers, pricing, navigation, ordered stock galleries, enquiry statuses and notification retries, private attachment downloads, approved media, verified reviews and central business settings.

## Production configuration

Copy `.env.example` into the hosting provider and supply all values. Launch is blocked until the following are also confirmed outside code:

- Production domain, clean logo assets and Google Business Profile/Maps URL
- Separate phone and WhatsApp numbers
- Calendly event URL and custom-answer order (`a1` vehicle, `a2` service, `a3` problem)
- Verified Resend sender domain and business notification recipient
- DVLA, Google Places, Turnstile, Sentry, GA4 and tawk.to credentials
- Approved privacy, cookie and website terms
- Set `LEGAL_COPY_APPROVED=true` and `COOKIE_CONFIGURATION_APPROVED=true` only after that approval is recorded
- Runtime Sentry reporting uses the server-side `SENTRY_DSN`; browser error boundaries send only scrubbed error summaries to the server endpoint.
- Genuine prices, media, reviews and vehicle stock where those sections are intended to be public

Preview deployments are blocked from indexing. Analytics and chat load only after the corresponding consent choice.
Consented GA4 sessions receive privacy-safe Core Web Vitals, including field INP, through the same typed analytics boundary as conversion events.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:lighthouse
```

`pnpm test` includes the customer-facing content regression, provider normalization, registration, CMS schema, analytics privacy and sold-vehicle lifecycle checks. CI repeats these checks under Node.js 22 and runs Chromium accessibility/journey tests plus Lighthouse thresholds.

## Important behavior

- Anonymous registration lookup data is never permanently stored.
- Registrations are excluded from URLs, analytics and ordinary logs.
- Only approved DVLA identity fields cross the provider boundary.
- Private enquiry images use short-lived signed upload access and are limited to five 8 MB JPG, PNG or WebP files.
- Closed ordinary enquiries are anonymised and their attachments removed after 12 months by the signed daily retention job.
- Publishing and unpublishing from the CMS revalidates the public route and sitemap immediately. Scheduled entries remain private until staff explicitly publish them; normal publishing does not depend on cron.
- The only Vercel cron is the signed daily retention cleanup, which is compatible with the Hobby plan.
- Sold vehicle pages become non-indexable immediately and redirect to inventory after 90 days.
- Optional gallery, review and advice content remains non-indexable until genuine approved records exist.
- Customer portals, payments, reminders and service history are intentionally outside Phase 1.
