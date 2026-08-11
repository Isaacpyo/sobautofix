# SOB Autofix enquiry Email Worker

This Worker forwards raw MIME for `*@reply.sobautofix.com` to the authenticated application endpoint. It contains no database credentials or business logic.

Set `CLOUDFLARE_EMAIL_WEBHOOK_SECRET` with Wrangler's encrypted secret command before deploying. Configure the deployed Worker as the catch-all action for the `reply.sobautofix.com` Email Routing subdomain. Do not alter the root-domain Email Routing rules or MX records.
