# SOB Autofix enquiry Email Worker

This Worker forwards raw MIME for `enquiry@reply.sobautofix.com` and its preserved `enquiry+<opaque-token>` subaddresses to the authenticated application endpoint. It contains no database credentials or business logic.

Set `CLOUDFLARE_EMAIL_WEBHOOK_SECRET` with Wrangler's encrypted secret command before deploying. Enable Email Routing subaddressing and route the literal `enquiry@reply.sobautofix.com` address to this Worker. Do not enable a catch-all or alter the root-domain Email Routing rules or MX records.
