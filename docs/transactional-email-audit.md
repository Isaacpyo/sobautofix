# Transactional email audit

Audited 13 August 2026 by searching application, worker, migration, test, and Supabase configuration paths for Resend sends and Auth email APIs.

| Email | Recipient | Delivery system | Active source | HTML before redesign? |
| --- | --- | --- | --- | --- |
| Enquiry acknowledgement | Customer, when an email is supplied | Resend | `src/lib/enquiries/repository.ts` | No |
| New enquiry notification | Business notification address | Resend | `src/lib/enquiries/repository.ts` | No |
| Enquiry staff reply | Customer | Resend + threaded inbound reply system | `src/lib/enquiries/thread-repository.ts` | No |
| Booking confirmation | Customer | Resend | `src/lib/bookings/notifications.ts` | No |
| Booking rescheduled | Customer | Resend | `src/lib/bookings/notifications.ts` | No |
| Booking cancellation | Customer | Resend | `src/lib/bookings/notifications.ts` | No |
| Issued invoice | Customer-selected recipient | Resend + persisted claim/reconciliation | `src/lib/invoices/repository.ts`, `email-delivery.ts` | No |
| Paid invoice copy | Customer-selected recipient | Resend + persisted claim/reconciliation | `src/lib/invoices/repository.ts`, `email-delivery.ts` | No |
| Admin password recovery | Authorised admin | Supabase Auth | `src/app/admin/login/actions.ts` (`resetPasswordForEmail`) | Dashboard-managed; not deployable from existing source |
| Password changed security notice | Authorised admin | Supabase Auth security notification | Triggered by successful `auth.updateUser({ password })` when project notification is enabled | Dashboard-managed; production state cannot be read from repository |

No application calls were found for sign-up confirmation, invite-user, magic-link/OTP, change-email, or reauthentication emails. The Cloudflare worker in `workers/enquiry-email` receives replies; it does not originate transactional email. Resend delivery webhooks update enquiry message state but do not originate new messages.

## Preserved delivery rules

- From: `SOB Autofix <notifications@sobautofix.com>`.
- Enquiry acknowledgement Reply-To: configured approved business address.
- Internal enquiry Reply-To: validated customer email when supplied, otherwise configured approved business address.
- Staff reply Reply-To: existing opaque `enquiry+<token>@reply.sobautofix.com` address when inbound configuration is available; existing business fallback otherwise.
- Booking Reply-To: configured approved business address.
- Invoice Reply-To: pinned to `sobautofix@gmail.com` and rejected if the configured identity differs.
- Thread subjects, `In-Reply-To`, `References`, provider message IDs, reply tokens, and Cloudflare routing are unchanged.
- Booking database reservation keys and provider idempotency keys are unchanged.
- Invoice logical send IDs, claims, revision checks, attachment bytes/hash, retry reconciliation, and Send Copy semantics are unchanged. The payload hash now also covers final HTML.
