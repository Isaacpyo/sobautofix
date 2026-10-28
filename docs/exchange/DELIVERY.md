# SOB Auto Exchange: delivery record

The governing brief is the overnight delivery brief of 28 Oct 2026 on top of the
Vehicle Buying & Selling Design Specification. **Nothing merges to `main` until it
meets this document's acceptance criteria.** Keep this file current: it is how an
interrupted session resumes without repeating work.

## Scope

In: showroom and listings; seller and part-exchange enquiries; buyer enquiries and
requested viewings; stock preparation, inspections and publishing; offers and
acquisition; sales and handover records; costs and reporting; the shared Autofix
Diary; mobile navigation for customers and staff.

Out: auctions, bidding, third-party listings, marketplace payouts, customer accounts,
online payments (no approved process exists), AI features (no AI integration is
authorised for SOB; the manual workflow is complete without it).

## Lifecycles (state machines)

| Record | States | Rules |
| --- | --- | --- |
| Seller submission | new → reviewing → provisional_offer → inspection → final_offer → purchased / declined / closed | Every offer is a `seller_offers` row (amount, conditions, expiry, decision); a new offer supersedes the open one. Purchase may create or link one stock record (`sale_vehicles.purchased_from_submission_id` is unique) copying vehicle facts only, never seller contact, offers or documents. |
| Stock | draft → preparation → available → reserved → sold; withdrawn (`archived`) | `canTransition()`; publish needs `getPublishReadiness()`; reservations and sales only through `vehicle_sales` (trigger syncs status; one active sale per vehicle); concurrent edits use compare-and-set on `updated_at`. |
| Viewing / appointment | requested → confirmed → completed / cancelled / no_show | Public submissions only create `requested`. One `diary_appointments` row is shared by the diary and the originating workflow. Conflicts rechecked at save; overrides record reason, actor and time. |
| Sale | reserved → awaiting_payment → ready_for_handover → completed / cancelled | Payment status is recorded, never collected. Completion is explicit and needs every handover checklist item (from Settings) ticked. Reservation expiry only from `reservationHoldDays` or a staff-entered date. |

Public submissions never confirm a viewing, accept an offer, reserve stock or mark a vehicle sold.

## Ownership

| Lane | Owner | Files |
| --- | --- | --- |
| Shared architecture, migrations 0900xx, integration, review, release | Lead | `supabase/migrations/202610280900*`, `src/lib/exchange/*.ts`, `src/config/exchange.ts`, `src/proxy.ts`, docs |
| 1. Customer experience | Agent (worktree) | `src/app/exchange/**`, `src/components/exchange/**`, `src/app/api/exchange/**`, `src/lib/exchange/public/**`, exchange email templates, main-site links |
| 2. Staff operations | Agent (worktree) | `src/app/admin/(protected)/exchange/**` except viewings, `src/components/admin/exchange/**`, `src/lib/exchange/admin/**`, `src/app/api/admin/exchange/**`, `/admin/inventory` redirects |
| 3. Diary and reliability | Agent (worktree) | diary, today, customers, viewings subtab, admin nav and mobile nav, `src/lib/diary/**`, notification retry sweep, then upload and permission verification across lanes |

## Acceptance criteria (merge gate)

Verified with synthetic data on the local stack, then smoke-tested after deploy:

1. Staff creates stock, records condition and photos, completes preparation and publishes it.
2. A customer filters stock, opens a listing and submits a viewing request.
3. Staff confirms it and the diary shows the same appointment.
4. A conflict is detected and a reschedule stays synchronised in both places.
5. A seller submits vehicle information and photos.
6. Staff reviews it, records offers (history kept) and inspection findings, and marks it purchased.
7. The purchase becomes linked stock without copying private seller information.
8. A part-exchange enquiry stays linked to the wanted vehicle.
9. A cancelled reservation and a completed sale update public availability correctly.
10. A notification or upload failure recovers without losing or duplicating the enquiry.
11. Unauthorised users cannot publish, change restricted finance data or fetch private documents.
12. Existing workshop booking and admin workflows still work.

Also: mobile layouts, keyboard use, reduced motion; validation keeps input; price and status consistency; money in integer pence; image loading; redirects and preview noindex; migration compatibility (old code on new schema, new code on old schema); `pnpm verify`, database tests and e2e green.

## Checks log

| When | Check | Result |
| --- | --- | --- |
| 28 Oct | Migrations 090000-090300 apply from scratch and re-apply | Pass |
| 28 Oct | pgTAP: 7 files, 174 tests (incl. exchange RLS/roles) | Pass |
| 28 Oct | Unit tests: 87 files, 475 tests; lint; typecheck; build | Pass |
| 28 Oct | Merged branch: lint, typecheck, 648 unit tests, production build | Pass |
| 28 Oct | Fresh `db reset` with migrations 090000-090400; pgTAP 8 files, 180 tests | Pass |
| 28 Oct | Vercel preview of branch | Failed: commit author `Claude <noreply@anthropic.com>` is not a Vercel project member (Hobby). Production merges are squash-merged by the GitHub user, so authored by the owner. |

## Blockers (exact next actions)

| Blocker | Action needed | Who |
| --- | --- | --- |
| Production migrations | `supabase link --project-ref nmebkkelpvhxxycrbbos && supabase db push --linked --dry-run && supabase db push --linked`, or add env secret `SOB_SUPABASE_ACCESS_TOKEN` (a token for the account that owns that project) | Owner |
| Exchange subdomain | Vercel project `sobautofix` → Domains → add `exchange.sobautofix.com`; Cloudflare DNS → `CNAME exchange cname.vercel-dns.com` (DNS only); then set `NEXT_PUBLIC_EXCHANGE_URL` and later `EXCHANGE_REDIRECTS_ENABLED=true` | Owner (no DNS-scoped token or Vercel access here) |
| Branch previews | Vercel Hobby rejects non-member commit authors | Optional: owner adds a preview workflow or accepts local verification |
| Policy wording, notification recipients, handover checklist, response-time promise | Enter approved content in Admin → Vehicle Buying & Selling → Settings | Owner |

## Resume log

- Foundation committed `542cbc2`, docs `c21cfcf`. The first agent attempt was lost in a session restart; agents relaunched and now commit WIP regularly.
- Lifecycle migration 090300 (offer history, handover checklist, override audit, notification retries, purchase-to-stock uniqueness) and settings `reservationHoldDays` and `handoverChecklist` added after the governing brief.

- 28 Oct 19:20: all three lanes merged into the delivery branch (customer `0031dc7`, diary and reliability, staff operations). Security pass defects fixed: document EXIF, idempotent document finalize, unfinalised seller photos, invoice access (lane 2); role-aware RLS migration 090400, production upload secrets, stock trash permission (lead). Staff guide added. Next: e2e merge gate (92 tests), then PR, CI, merge.

## Release and rollback

See `docs/exchange/OPERATIONS.md`.
