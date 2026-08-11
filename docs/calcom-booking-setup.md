# Cal.com booking setup

SOB Autofix owns the customer booking journey. Cal.com is used only behind the server-side scheduling adapter; Supabase remains the business record and Resend remains the customer-email layer.

## Account and Event Types

1. Create or select the SOB Autofix Cal.com account/team.
2. Connect the real business calendar and verify calendar conflict handling.
3. Configure verified working availability. Do not infer availability from website copy or configure 24/7 hours without business approval.
4. Create a separate Event Type for each service/location combination that needs different duration, buffers, notice, booking window, conflict rules, or location behavior.
5. Keep duration and availability rules in the Event Type rather than application code.
6. In **Admin → Bookings → Service setup**, enter each real Event Type ID and enable online booking only after its slots have been tested.

The migration seeds disabled service definitions. It does not contain invented Event Type IDs or durations.

## Server environment

Configure these as server-only values in Production and Preview where booking is required:

```env
CALCOM_API_KEY=
CALCOM_WEBHOOK_SECRET=
CALCOM_DEFAULT_TIMEZONE=Europe/London
BOOKING_MANAGEMENT_SECRET=
```

Never prefix these values with `NEXT_PUBLIC_`. Keep the independent booking-management secret high entropy and do not reuse the Supabase secret key.

## Webhook

Create a user webhook targeting:

```text
https://<production-domain>/api/webhooks/calcom
```

Subscribe only to:

```text
BOOKING_CREATED
BOOKING_RESCHEDULED
BOOKING_CANCELLED
```

Set webhook payload version `2026-07-27` and a webhook secret matching `CALCOM_WEBHOOK_SECRET`. The payload version is separate from endpoint API-version headers. The application verifies `X-Cal-Signature-256` against the exact raw request body before parsing. Validate a sample for each lifecycle event before launch.

## Customer notifications

SOB Autofix sends confirmation, reschedule, and cancellation messages through Resend with idempotency keys. Review the Event Type and workflow notification settings so customers do not also receive a competing generic scheduling confirmation. A connected-calendar invitation may still be desirable; test the exact customer experience with an external email account.

## Production acceptance

After applying the booking migrations and deploying the environment variables:

1. Verify the health endpoint shows booking availability operational and at least one mapped service.
2. Complete a controlled booking through `/book` and confirm the local `SOB-######` record, email, Admin Bookings entry, and connected calendar event.
3. Find it through `/manage-booking` with reference + registration + email.
4. Reschedule inside SOB Autofix and verify local history, email, and calendar change.
5. Cancel inside SOB Autofix and verify local status, email, and calendar change.
6. Confirm there are no third-party booking iframes, scripts, redirects, or browser-side API credentials.

Payments and deposits are deliberately out of scope. Add them only as a separately approved phase.
