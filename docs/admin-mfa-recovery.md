# Admin MFA recovery

SOB Autofix uses Supabase Auth TOTP factors and does not create application recovery codes or store authenticator secrets.

If the authorised administrator loses access to every enrolled authenticator, a trusted Supabase project owner must remove the affected factor from the user in the Supabase Dashboard under Authentication > Users. Confirm the administrator identity through an established offline process before removal. The administrator can then sign in with their password and enroll a new authenticator from Admin > Configuration > Security.

Never add a bypass flag, database recovery code, or service-role endpoint to the application.

## Deployment prerequisite

The repository enables TOTP enrollment and verification in `supabase/config.toml`. Before production enrollment, push the linked project configuration or confirm in Supabase Dashboard under Authentication > Multi-Factor Authentication that TOTP enrollment and verification are enabled. Apply all pending migrations, including `202608130001_require_mfa_for_enrolled_admin.sql`, so RLS requires AAL2 after a factor is enrolled.
