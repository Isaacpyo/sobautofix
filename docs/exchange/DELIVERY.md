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
| 28 Oct | Local e2e gate, 92 tests (desktop + mobile): 59 passed, 14 skipped (need local setup), 19 failed | All exchange, admin-exchange and diary journeys pass except one axe contrast hit on the toast fade-in (fixed: slide-only entrance). The 18 booking and marketing failures also fail on unmodified `main` in the same environment (32 failures there): no CMS content, local site URL, no booking catalogue seed. Not regressions. |
| 28 Oct | CI history | No CI run had ever passed. `verify` failed at build: sitemap needs a non-localhost `NEXT_PUBLIC_SITE_URL`. Fixed in the workflow env (also least-privilege permissions and concurrency). |
| 28 Oct | Vercel preview of branch | Failed: commit author `Claude <noreply@anthropic.com>` is not a Vercel project member (Hobby). Production merges are squash-merged by the GitHub user, so authored by the owner. |
| 28 Oct | Merged and deployed (PR #1) | First green CI in the repo's history; production smoke test passed |
| 29 Oct | Mobile and admin fixes (PRs #2 to #4) | Raised Sell button clearance, two-up home journeys, Finance & settings tab; live checks passed |
| 30 Oct | Lighthouse gate (PR #5) | Median of 3 runs per URL; flaky single-run failures removed |
| 30 Oct | Production migrations (PRs #6, #7) | Applied 20261028090000 to 090400 with the `Production migrations` workflow; history matches; all 12 exchange tables present |
| 30 Oct | Subdomain and redirects | exchange.sobautofix.com live over HTTPS; `NEXT_PUBLIC_EXCHANGE_URL` and `EXCHANGE_REDIRECTS_ENABLED=true` set; old /exchange and /cars-for-sale links 308 to the subdomain (owner verified) |
| 30 Oct | Owner review fixes (PRs #8, #9) | Number plate input, map, policies footer column, collapsible mobile footer, new home imagery and headline, full catalogue filters, main-site links straight to the subdomain; live checks passed |
| 30 Oct | Settings content | Owner pasted approved wording (draft doc: claude.ai/artifact/TVgAMRyqU4ZfeuVifPXBNC); no "finalising" placeholders left on live pages |

## Status of earlier blockers

| Item | Status |
| --- | --- |
| Production migrations | Done 30 Oct. Future migrations: run **Production migrations** (Actions, `workflow_dispatch`): `dry-run` from any branch, `apply` with `confirm=APPLY` from `main` only. Uses repository secret `SOB_SUPABASE_ACCESS_TOKEN` (fine-grained: `database_pooling_config_read`, `database_write`); the owner is keeping it for future migrations. |
| Exchange subdomain | Done 30 Oct (Vercel domain, Cloudflare CNAME, both env vars, redirects on). |
| Settings content | Done 30 Oct. Finance is left open-ended ("ask us"); HPI checks confirmed. |
| Branch previews | Vercel Hobby only deploys Git pushes authored by the owner. `vercel.json` turns off Vercel's own previews for `claude/*` branches, and `.github/workflows/preview-deploy.yml` deploys previews with the Vercel CLI instead. Needs repository secret `VERCEL_TOKEN` (owner's Vercel token); skipped until it is set. |

## Owner to-dos (not code)

- Complete **Condition & disclosure** for the two live cars (Hyundai Santa Fe MX60 OKJ, Vauxhall Meriva HF16 JKK): 11 fields show "Not confirmed".
- Review **Settings → Staff roles**: every existing admin became Owner.
- Send one real viewing request and one sell-my-car enquiry and confirm both emails reach info@sobautofix.com.

## Resume log

- Foundation committed `542cbc2`, docs `c21cfcf`. The first agent attempt was lost in a session restart; agents relaunched and now commit WIP regularly.
- Lifecycle migration 090300 (offer history, handover checklist, override audit, notification retries, purchase-to-stock uniqueness) and settings `reservationHoldDays` and `handoverChecklist` added after the governing brief.

- 28 Oct 19:20: all three lanes merged into the delivery branch (customer `0031dc7`, diary and reliability, staff operations). Security pass defects fixed: document EXIF, idempotent document finalize, unfinalised seller photos, invoice access (lane 2); role-aware RLS migration 090400, production upload secrets, stock trash permission (lead). Staff guide added. Next: e2e merge gate (92 tests), then PR, CI, merge.

- 30 Oct: all owner blockers cleared (migrations applied, subdomain live, settings published). Production staff journeys are tested on the local stack only; the first real listing is the production check.

## Release and rollback

See `docs/exchange/OPERATIONS.md`.
