# SOB Auto Exchange: architecture and build contract

SOB Autofix buys vehicles from customers and sells its own stock. This adds a
customer app (SOB Auto Exchange, tentative name) on `exchange.sobautofix.com`,
a **Vehicle Buying & Selling** section and an **Autofix Diary** in the existing
admin. Same Next.js 16 app, same Supabase project, same staff logins.

Read `docs/exchange/DECISIONS.md` for the decisions behind this document.

## Hosting model

| Where | URL | How |
| --- | --- | --- |
| Exchange host (production) | `https://exchange.sobautofix.com/cars` | `src/proxy.ts` rewrites to `/exchange/cars` and sets `x-exchange-host: 1` |
| Any other host (previews, main domain, local) | `/exchange/cars` | served directly |
| Local exchange host | `http://exchange.localhost:3000/cars` | same as production host |

- Build every in-app link with `useExchangeHref()` (client) or `exchangeHref(await getExchangeBase(), path)` (server). Never hard-code `/exchange/...`.
- Canonical URLs: `exchangeCanonical(path)` (always the exchange host). Robots: index only when `isExchangeIndexable()`; otherwise `noindex`.
- `/admin` stays on the main site. The exchange host redirects `/admin` there.
- `EXCHANGE_REDIRECTS_ENABLED=true` (production, after DNS) permanently redirects `/cars-for-sale[/slug]` and `/exchange/*` on the main site to the exchange host. Until then the old pages keep working.

## Data model (supabase/migrations/20261028090000-20261028090200)

| Table | Purpose | Access |
| --- | --- | --- |
| `sale_vehicles` (+ new columns) | Stock and **public** disclosures: `stock_reference`, `listing_condition`, `write_off_status`, `condition_summary`, `known_faults[]`, `work_completed[]`, inspection summary, `mot_expiry`, `service_history`, owners, keys, history check, `listed_at`, `reserved_at`. Status adds `preparation`; `archived` is shown as **Withdrawn**. | Public RLS shows available/reserved/recently sold. **Only public-safe data goes here.** |
| `vehicle_internal_records` | Acquisition date/source, internal notes | finance roles |
| `vehicle_costs` | Cost lines in pence, `basis` estimated/actual | finance roles |
| `vehicle_prep_items` | Preparation checklist | staff |
| `vehicle_inspections` | Purchase or pre-sale inspections | staff |
| `vehicle_documents` | Private files (bucket `vehicle-documents`) | staff |
| `seller_submissions` (+ `seller_submission_photos`, bucket `seller-submission-photos`) | Sell your car / part exchange, offers, purchase | staff |
| `enquiries` (+ `sale_vehicle_id`, `sales_stage`, `assigned_to`, `follow_up_at`, `source`, `idempotency_key`) | Sales enquiries (type `vehicle_sales`) and the email thread for seller submissions (type `vehicle_purchase`) | staff |
| `vehicle_sales` | Reservation, payment status (recorded, not taken online), handover | staff; a trigger keeps `sale_vehicles.status` in step |
| `diary_appointments` | Viewings, purchase inspections, preparation, collections, handovers, other | staff |
| `bookings` (+ `assigned_to`) | Existing workshop bookings, shown in the diary directly (never copied) | staff |
| `exchange_settings` / `exchange_private_settings` | Public copy and contact / recipients and thresholds | public read / finance roles read, owner write |
| `admin_profiles.staff_role` | owner, manager, sales, workshop | |

Money: `sale_vehicles.price` is whole **pounds** (existing). Every new money column is **pence**. Convert only through `src/lib/exchange/margin.ts`.

Public writes go only through `create_vehicle_enquiry(jsonb)` and `create_seller_submission(jsonb)` (service role, atomic, idempotent on `idempotencyKey`, recheck vehicle availability). Notifications are sent **after** the save, recorded in `notification_attempts`, and `enquiries.notification_status` shows failures for retry (existing pattern in `src/lib/enquiries/repository.ts`).

If the migration has not reached a database, queries fail with codes recognised by `isMissingSchemaError()`. Pages must then show `SCHEMA_MISSING_MESSAGE` (admin) or a calm "temporarily unavailable" state (public). Never crash, never leak the raw error.

## Shared modules (already written; extend, don't fork)

- `src/config/exchange.ts`: defaults, policy pages, `NOT_CONFIRMED`, `NOT_PUBLISHED_COPY`, `exchangeBaseUrl()`
- `src/lib/exchange/settings.ts`: `getExchangeSettings()`, `getExchangePrivateSettings()`, `getExchangeNotificationRecipients()`
- `src/lib/exchange/permissions.ts`: roles and `can(role, permission)`
- `src/lib/exchange/staff.ts`: `requireStaffPage(permission)`, `requireStaffAction(permission)`, `getStaffForRoute(permission)`, `auditStaffAction()`
- `src/lib/exchange/readiness.ts`: `getPublishReadiness()`, `canTransition()`
- `src/lib/exchange/margin.ts`: `summariseMargin()`, `daysInStock()`, `formatPence()`, `MARGIN_DEFINITION`
- `src/lib/exchange/host.ts`, `links.ts`, `components/exchange/exchange-base.tsx`: links and host
- `src/lib/exchange/schema.ts`: `isMissingSchemaError()`, `SCHEMA_MISSING_MESSAGE`
- `src/lib/sales/repository.ts`: `mapVehicle()` maps every disclosure column
- `src/lib/content-guard.ts`: `assertExchangeContent()` for exchange copy (MOT facts allowed, MOT services not); main site keeps `assertCustomerFacingContent()`

## Permissions

| Permission | owner | manager | sales | workshop |
| --- | :-: | :-: | :-: | :-: |
| exchange.view, diary.manage | yes | yes | yes | yes |
| stock.edit | yes | yes | yes | |
| stock.publish, stock.price | yes | yes | | |
| finance.view, finance.edit | yes | yes | | |
| buying.manage, sales.manage, customers.view | yes | yes | yes | |
| prep.manage | yes | yes | | yes |
| settings.manage | yes | | | |

Check on the server in every page (`requireStaffPage`) and action (`requireStaffAction`). Hide controls a role cannot use, but the server check is the rule. Customer-facing code never selects private tables.

## Admin URL contract (link to these; do not invent others)

```
/admin/exchange                       Overview
/admin/exchange/stock                 Vehicle Stock list      /stock/new   /stock/[id]
/admin/exchange/buying                Buying Enquiries        /buying/[id]
/admin/exchange/sales                 Sales Enquiries         /sales/[enquiryId]
/admin/exchange/enquiries/new         Staff-created enquiry (?type=buying|sales)
/admin/exchange/viewings              Viewings & Appointments
/admin/exchange/preparation           Preparation & Inspections
/admin/exchange/handover              Sales & Handover        /handover/[saleId]
/admin/exchange/reports               Costs & Reporting
/admin/exchange/settings              Settings
/admin/diary                          ?view=day|week|month|agenda&date=YYYY-MM-DD&type=&staff=&status=
/admin/diary/new                      ?kind=&start=&vehicle=&enquiry=&submission=&sale=&customer=
/admin/diary/[id]
/admin/today                          Mobile "Today"
/admin/customers                      /customers/[id]
```

## Customer URL contract (paths on the exchange host)

```
/                          Home
/cars                      Catalogue (filters in the query string)
/cars/sold                 Recently sold archive
/cars/[slug]               Vehicle detail (same slugs as /cars-for-sale/[slug])
/sell                      Sell your car (?vehicle=<slug> makes it a part exchange)
/part-exchange             How part exchange works
/how-buying-works          Viewing, payment, collection/delivery, after-sales, warranty vs statutory rights
/about  /contact  /more
/policies  /policies/[slug]
/robots.txt  /sitemap.xml  (route handlers under src/app/exchange)
API: /api/exchange/vehicle-enquiries, /api/exchange/seller-submissions, /api/exchange/seller-submissions/[id]/photos/{sign,finalize}
```

## Design system (exchange and new admin screens)

Brand continuity with sobautofix.com (Barlow Condensed headings, Inter body, SOB blue), but a lighter showroom feel.

| Token | Value | Use |
| --- | --- | --- |
| ink | `#0B1220` | headings, prices |
| text | `#344054` | body |
| muted | `#5B6575` | secondary text (5.9:1 on white) |
| surface / surface-2 | `#FFFFFF` / `#F3F5F8` | page / bands, cards on grey |
| line | `#E3E8EF` | borders |
| charcoal | `#111827` | dark bands, footer |
| accent | `#1974E2` (hover `#1462C4`) | primary actions, active nav; text links use `#1462C4` |
| accent-soft | `#EAF2FD` | selected chips, info panels |
| Available | `#067647` on `#ECFDF3` | always with the word |
| Reserved | `#93370D` on `#FFFAEB` | always with the word |
| Sold / Withdrawn | `#B42318` on `#FEF3F2` / `#344054` on `#F2F4F7` | always with the word |

Radius 16px cards, 12px inputs and buttons, full pills for chips. Prices in Barlow Condensed 700. Phone first at 390px, then 768px and 1280px. Touch targets at least 44px. Real `<button>` and `<label>`. Visible focus (`outline: 3px solid rgba(22,139,255,.55)`). `lucide-react` icons, no emoji. Contrast at least 4.5:1.

**Mobile bottom navigation** (customer: Home, Browse Cars, **Sell My Car** centre, Contact, More; admin: Today, Diary, **New** centre, Customers, More): white bar fixed to the bottom with `padding-bottom: env(safe-area-inset-bottom)`, top border `line`, 64px tall, five equal columns, 22px icon above an 11px semibold label. Active item is accent; inactive is muted. The centre item is a 56px accent circle with a white plus, raised 16px above the bar, with its label underneath. Hidden at `lg` and up. Pages reserve `calc(64px + env(safe-area-inset-bottom) + 16px)` at the bottom. On a vehicle detail page the compact action bar (Book a viewing / Ask) sits directly above the bottom nav, and the page reserves room for both. Nothing fixed may cover a form control: forms scroll their submit button into view above the bars.

## Rules that must hold

1. Registrations, names, emails, phones, postcodes and uploads never go into URLs, analytics or logs. Seller state between steps stays in client memory (and an optional `sessionStorage` draft without photos).
2. Never invent vehicle facts, reviews, inspection results, warranty cover or response times. Unknown means **Not confirmed**. Unpublished policy copy shows `NOT_PUBLISHED_COPY`.
3. MOT may appear only on exchange pages and admin, and only as a vehicle fact. The main site keeps the full ban (`src/__tests__/content-guard.test.ts`).
4. No online payments, auctions, bidding, third-party sellers or customer accounts.
5. Uploads: JPG/PNG/WebP up to 8 MB (seller photos, max 12), PDF/JPG/PNG/WebP up to 15 MB (documents). Check the magic bytes on the server and re-encode images with `sharp` (`.rotate()` then re-encode, which drops EXIF/GPS) before storing.
6. Every staff change worth knowing (price, status, offer, sale, assignment, settings) writes `auditStaffAction()`.
7. Local dev never sends email: start the server with `env -u RESEND_API_KEY`.

## Local development

```bash
pnpm install
cp /home/user/sobautofix/.env.local .            # in a worktree
pnpm exec supabase status                         # shared local stack on :54321 (already running)
node scripts/exchange-local-seed.mjs              # demo stock and staff logins (local only)
env -u RESEND_API_KEY pnpm dev --port <yours>     # customer: http://exchange.localhost:<port>/  admin: http://localhost:<port>/admin
```

Staff logins (local only): `sobautofix@gmail.com` (owner) and `temitopeagbola@gmail.com` (sales), password in `scripts/exchange-local-seed.mjs`.

Before handing back: `pnpm lint && pnpm typecheck && pnpm test` must pass. `pnpm build` must pass (run with `env -u RESEND_API_KEY`).
