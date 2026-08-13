# SOB Autofix Supabase keepalive Worker

`sobautofix-keepalive` performs a read-only request to
`https://sobautofix.com/api/health` at 06:00, 14:00 and 22:00 UTC each day.
The health endpoint performs live Supabase `SELECT` queries and returns
`Cache-Control: no-store`; the Worker also requests `Cache-Control: no-cache`.
It has no bindings, secrets, database credentials or business-data write path.

## Manual scheduled test

Start the Worker locally:

```powershell
pnpm exec wrangler dev --test-scheduled --config workers/keepalive/wrangler.jsonc
```

Then invoke the scheduled handler:

```powershell
curl.exe "http://localhost:8787/cdn-cgi/handler/scheduled?format=json"
```

The result should report `"outcome":"ok"`, and the Worker log should contain
HTTP status `200` with `Health check succeeded`.

## Disable the cron

Set `triggers.crons` to an empty array in `wrangler.jsonc` and redeploy. Do not
remove only the key: Cloudflare documents an empty array as the explicit way to
delete Wrangler-managed Cron Triggers.

```powershell
pnpm exec wrangler deploy --config workers/keepalive/wrangler.jsonc
```

This Worker is intentionally separate from `sobautofix-enquiry-email` and does
not interact with Email Routing or the enquiry pipeline.
