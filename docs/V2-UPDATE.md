# SOB Autofix v2: update complete

**Status: done and live** (1 November 2026). Everything below is merged to `main`, deployed to production by Vercel, and the production database has every v2 migration applied.

v1 was the workshop website and the staff CMS. v2 adds **SOB Auto Exchange** (vehicle buying and selling), the **Autofix Diary**, a phone-first admin and **Staff & access** with roles across the whole admin.

## Where it runs

| What                          | Where                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Workshop site                 | sobautofix.com                                                                     |
| SOB Auto Exchange (customers) | exchange.sobautofix.com (old `/exchange` and `/cars-for-sale` links redirect here) |
| Admin                         | sobautofix.com/admin                                                               |

## What v2 shipped

| PR     | Area                   | What changed                                                                                                                                                                                                                                                                                                                              |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1     | Exchange, admin, diary | Customer exchange (catalogue, vehicle pages, viewing and question enquiries, sell-your-car with photos); admin Vehicle Buying & Selling (stock, disclosures, photos, buying, sales and handover, preparation, costs and reporting, settings); Autofix Diary and Today; Customers; mobile admin navigation; role-aware RLS; retention jobs |
| #2     | Exchange (phone)       | Raised Sell button no longer covers Ask; Buy and Sell journeys side by side                                                                                                                                                                                                                                                               |
| #3, #4 | Admin exchange         | Costs & Reporting and Settings under a **Finance & settings** tab                                                                                                                                                                                                                                                                         |
| #5     | CI                     | Lighthouse judged on the median of three runs                                                                                                                                                                                                                                                                                             |
| #6, #7 | CI                     | **Production migrations** workflow (dry run from any branch, apply from `main` only)                                                                                                                                                                                                                                                      |
| #8     | Exchange               | Number plate input, Google map, Policies footer column, collapsible footer on phones                                                                                                                                                                                                                                                      |
| #9     | Exchange               | New home imagery and headline, full catalogue filters, main-site links go straight to the exchange                                                                                                                                                                                                                                        |
| #10    | CI, exchange           | Vercel previews through the CLI; condition summary optional for publishing                                                                                                                                                                                                                                                                |
| #11    | Admin                  | Clear vehicle lookup errors; admin pages no longer stall on load                                                                                                                                                                                                                                                                          |
| #13    | Admin                  | **Staff & access** (`/admin/staff`): owners invite staff, set roles (Owner, Manager, Sales, Workshop), remove and restore access. Roles now gate invoices, website content, pricing, settings and staff                                                                                                                                   |
| #14    | Admin                  | Accurate System health (no false "Database: Degraded"), sign-out confirmation, dashboard fits a 390px phone                                                                                                                                                                                                                               |

## Database

Applied to production with the Production migrations workflow:

- `20261028090000_exchange_enum_values.sql`
- `20261028090100_auto_exchange.sql`
- `20261028090200_explicit_api_grants.sql`
- `20261028090300_exchange_lifecycle_records.sql`
- `20261028090400_exchange_role_aware_policies.sql`
- `20261101090000_staff_access.sql`

## Checks at release

- `pnpm verify` passes: lint, typecheck, 681 unit tests and the production build.
- Database tests: 9 pgTAP files, 193 tests, run against a fresh `db reset`.
- Integration tests (22) and the invoice PDF browser test.
- Playwright journeys pass for exchange customers, admin exchange, diary and staff access.
- CI is green on every merged PR, and the production smoke checks passed.

## Left for the owner (not code)

- Check **System → Staff & access**: only the expected Owners should be listed. Then invite the rest of the team with the right roles.
- Ask everyone to turn on two-step verification (**Security** in the admin menu).
- Send one real viewing request and one sell-my-car enquiry from exchange.sobautofix.com, and confirm both emails arrive at info@sobautofix.com.

## Read next

- `docs/exchange/STAFF-GUIDE.md`: how staff use v2
- `docs/exchange/ARCHITECTURE.md`: tables, modules and routes
- `docs/exchange/DECISIONS.md`: decisions D1 to D22
- `docs/exchange/DELIVERY.md`: checks log and blocker history
- `docs/exchange/OPERATIONS.md`: release, migrations and rollback
