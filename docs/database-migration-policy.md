# Database migration policy

Use the normal linked Supabase migration workflow for every production schema or controlled data change.

- Give every new migration a version later than the highest migration already present locally or remotely. Never recycle a retired or applied version.
- Audit and test each migration independently. An unrelated migration may ship in the same ordered push only when it is independently production-safe and intended for production.
- Apply validated, production-safe migrations promptly when their functionality is approved for deployment. Do not leave them pending indefinitely.
- Run `supabase migration list --linked` and `supabase db push --linked --dry-run` before every production push. Stop if the pending set contains anything unexpected.
- Never rename or edit an already-applied migration. If a local filename appears inconsistent, inspect `supabase_migrations.schema_migrations` before acting.
- Never use `supabase migration repair --status applied` to bypass SQL. Repair history only after verifying that the exact intended database effects already exist and the history row is the sole discrepancy.
- After a push, verify migration history, the intended database state, regression tests, and production health.
