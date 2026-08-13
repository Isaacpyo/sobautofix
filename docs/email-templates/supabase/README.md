# Supabase Auth email templates

The application-controlled email renderer must not send Supabase recovery links. Supabase Auth remains responsible for recovery tokens and delivery.

## Active flows

- `resetPasswordForEmail` is called by the admin login recovery action.
- A successful recovery calls `auth.updateUser({ password })`.
- No application code calls sign-up confirmation, invite, magic-link/OTP, change-email, or reauthentication email APIs.

The local Supabase stack uses [recovery.html](../../../supabase/templates/recovery.html) and [password_changed_notification.html](../../../supabase/templates/password_changed_notification.html) through `supabase/config.toml`. Hosted Supabase does not deploy these files automatically.

## Required hosted-project action

1. Open the production Supabase project.
2. Go to **Authentication → Email Templates → Reset password**.
3. Set the subject to `Reset your SOB Autofix admin password`.
4. Paste the complete contents of `supabase/templates/recovery.html` and save it. Do not replace `{{ .ConfirmationURL }}`.
5. Go to **Authentication → Email Templates → Security notifications → Password changed**.
6. Enable the notification, set the subject to `Your SOB Autofix admin password was changed`, paste `supabase/templates/password_changed_notification.html`, and save it.
7. In **Authentication → Email**, confirm custom SMTP sends from an approved `sobautofix.com` identity. No SMTP credentials belong in this repository.
8. Send one controlled recovery to the authorised admin test address and verify the redirect reaches `/auth/confirm?next=/admin/reset-password`.

Supabase recommends disabling link tracking in the SMTP provider because rewritten authentication links may fail. No production dashboard or SMTP change was made as part of this source change.
