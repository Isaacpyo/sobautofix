@AGENTS.md

# SOB Autofix: project guide for Claude Code

Next.js 16 (App Router), React 19, Tailwind 4, Supabase (Postgres, Auth, Storage), zod, Resend, Sentry, Vitest, Playwright. One app serves the workshop site (sobautofix.com), the admin (`/admin`) and SOB Auto Exchange (`exchange.sobautofix.com`, code in `src/app/exchange`). Start with `docs/exchange/ARCHITECTURE.md` and `docs/exchange/DECISIONS.md` for anything to do with vehicle buying and selling or the diary.

## Working autonomously

Routine work within this project is pre-approved. Do it end to end without stopping for confirmation:

- Planning, design and implementation decisions, dependencies, configuration and refactors that serve the task.
- Additive, idempotent database migrations, with tests.
- Tests, commits, pushes, pull requests, and merging your own PR once every CI check on its head commit is green and it meets its acceptance criteria (squash merge).
- The production deploy that merging to `main` triggers (Vercel Git integration), and verifying it afterwards.
- Applying reviewed migrations to the linked Supabase project, following `docs/database-migration-policy.md` (`migration list`, `db push --dry-run`, then `db push`, then verify).
- Production env vars and secrets a merged feature needs, set in the provider's store by name.

Ask first only for:

- Spending money, new paid services or plans, or billing changes.
- Destructive data changes outside a documented retention job (dropping tables or columns, manual deletion of production records).
- DNS, domain or account-security settings when you lack authorised access, and any login, 2FA or CAPTCHA (say exactly what the person must do).
- Sending email or messages to real customers, or publishing legal or policy wording that has not been approved.

When something is blocked, finish everything around it and report the exact blocker and the exact action needed.

## Rules that must hold

1. **Secrets**: only in `.env.local` (gitignored) or the hosting provider's secret store. Never print, log or commit values; refer to them by name and add new names to `.env.example`. Never use a `NEXT_PUBLIC_` name for a secret.
2. **Privacy**: registrations, names, contact details and uploads never go into URLs, analytics or ordinary logs. Private data (costs, notes, documents, offers) never reaches customer-facing code.
3. **Honesty**: never invent reviews, inspection results, warranty cover, response times or vehicle facts. Unknown means "Not confirmed".
4. **MOT**: banned from the main site (`src/__tests__/content-guard.test.ts`). The exchange may state a car's MOT expiry and history as a fact; MOT services are banned everywhere (`guardExchangeContent`).
5. **Access**: every admin page and action checks the staff role on the server (`src/lib/exchange/staff.ts`); RLS stays enabled on every table.
6. **Rollout safety**: code must keep working before its migration is applied (`isMissingSchemaError`). Never edit an applied migration.
7. **No test email**: local servers run with `env -u RESEND_API_KEY`.

## Commands

```bash
pnpm install
pnpm exec supabase start && node scripts/exchange-local-seed.mjs   # local DB with demo data
env -u RESEND_API_KEY pnpm dev      # site http://localhost:3000, exchange http://exchange.localhost:3000
pnpm verify                         # lint + typecheck + unit tests + build: must pass before every commit
pnpm exec supabase test db --local supabase/tests/database
pnpm test:e2e
```

Commit trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`.
