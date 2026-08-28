# Administrator MFA recovery and rollout

SOB Autofix uses Supabase Auth TOTP for normal administrator access. A verified factor requires a genuine `aal2` JWT for privileged database access. Application recovery codes never create or imitate an `aal2` session.

## Recovery-code model

- A set contains 10 independently generated, 100-bit codes formatted as five groups of four characters.
- Plaintext is returned only in the Server Action response immediately after creation. It is never written to PostgreSQL, logs, cookies, browser storage or audit metadata.
- PostgreSQL stores only SHA-256 hashes in `admin_mfa_recovery_codes`. The codes have enough entropy that offline guessing remains infeasible even if hashes are disclosed.
- The table and its RPCs are inaccessible to `anon` and `authenticated`. Only the trusted service-role server boundary can create or consume records.
- `consume_admin_mfa_recovery_code` uses one guarded `UPDATE ... WHERE used_at IS NULL AND revoked_at IS NULL RETURNING id`. PostgreSQL row locking makes concurrent reuse strictly single-use.
- Regeneration requires a genuine AAL2 application session, revokes every unused previous code, revokes active recovery capabilities and remembered devices, then returns a new plaintext set once.

## Lost-authenticator flow

1. The administrator first authenticates the account with Supabase. A code alone is not a login credential.
2. `/admin/mfa/recover` accepts an unused recovery code under conservative per-account and per-source rate limits.
3. Atomic consumption revokes trusted devices and issues a random 15-minute capability. The browser receives only the raw capability in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie scoped to the recovery route; PostgreSQL stores its hash.
4. The old verified TOTP factor remains active while a replacement factor is enrolled.
5. The administrator must prove the replacement factor works with a current six-digit TOTP. This creates a genuine AAL2 session.
6. Only then does a service-role server operation delete the old factor IDs captured when the recovery code was consumed. Supabase logs out active sessions when a verified factor is deleted.
7. The application records the replacement and global-sign-out events, completes the capability, clears its cookie, and requires a fresh password plus new-factor login.

At no stage does the recovery capability authorize ordinary admin data, APIs, server mutations, factor removal settings or recovery-code generation. Until the new TOTP verifies, the existing factor keeps the account at `aal1` for the recovering browser and normal authorization continues to fail closed.

## Email compromise

A Supabase password-recovery session is accepted only for changing the password. Password change revokes trusted devices and signs out all sessions. When a verified factor exists, the new password still produces `aal1 -> aal2`; it cannot:

- enter protected admin pages or invoke privileged mutations;
- open the security settings through trusted-device exemption;
- remove or replace a factor without a single-use recovery code;
- create or regenerate recovery codes without genuine AAL2;
- bypass `public.is_admin()`, which requires the JWT `aal` claim to be `aal2` whenever a verified factor exists.

## Total loss: phone and every recovery code

There is deliberately no email-only or public-application escape hatch. Recovery requires a trusted Supabase project owner to perform an offline procedure:

1. Stop and preserve relevant Auth/application audit evidence. Treat the event as a possible account compromise.
2. Verify the requester outside the web login flow using pre-established business-owner evidence and a known communication channel. Email inbox access alone is insufficient.
3. From a separately protected Supabase owner account, identify the exact Auth user and factor IDs. Do not accept an ID supplied by the requester without matching it to the project record.
4. Revoke active sessions and remembered-device rows. Remove the lost verified factor through Supabase Dashboard Authentication > Users or the documented Admin MFA API.
5. Keep mandatory MFA disabled only if necessary for this controlled bootstrap. Have the owner sign in, immediately enroll and verify a new TOTP factor, save a newly generated recovery-code set, and then restore mandatory enforcement.
6. Review `admin_audit_log`, Supabase Auth logs and recent privileged changes before returning the account to normal use. Rotate the password and any other credentials if compromise is suspected.

This procedure must not be automated through a public route or email link.

## Mandatory-MFA rollout switch

Migration `202608130008_admin_mfa_recovery.sql` creates `admin_mfa_policy` with `mandatory_mfa_enabled = false`. Both application routing and `public.is_admin()` read this server-only value. While false, an administrator with no factor can complete the controlled enrollment rollout. Once true:

- no-factor administrators are restricted to `/admin/mfa/enroll`;
- enrolled AAL1 administrators are restricted to `/admin/mfa`;
- recovery capability holders are restricted to `/admin/mfa/recover`;
- only AAL2 (or the existing ordinary-navigation trusted-device policy where explicitly allowed) reaches the admin shell;
- sensitive operations and database RLS still require genuine AAL2.

Enable the switch only after production TOTP and recovery codes have been verified:

```sql
update public.admin_mfa_policy
set mandatory_mfa_enabled = true,
    updated_at = now(),
    updated_by = '<ADMIN_AUTH_USER_UUID>'::uuid
where singleton;
```

Disabling the switch is a manual project-owner incident action, not an application feature.

## Production sequence

1. Review migrations `202608130007_admin_trusted_devices.sql` and `202608130008_admin_mfa_recovery.sql`.
2. Run linked migration list and dry-run checks; apply only the reviewed pending set.
3. Deploy recovery/enrollment application code while mandatory MFA remains false.
4. Sign in as the existing administrator.
5. Enroll TOTP and verify a live code.
6. Securely save all 10 displayed recovery codes.
7. Confirm Security reports 10 of 10 codes remaining and test a normal sign-out/sign-in TOTP challenge without consuming a recovery code.
8. Set `mandatory_mfa_enabled = true` through the reviewed Supabase owner workflow.
9. Smoke-test no-factor restriction (with a controlled non-production fixture), enrolled AAL1 challenge, AAL2 access, sensitive step-up and the documented recovery route.
10. Preserve deployment, migration and smoke-test evidence.

Never enable mandatory MFA before steps 4-7 succeed for the sole production administrator.

## Authenticator ownership handover

An administrator who still has access to the current factor should use **Admin → Configuration → Security → Replace authenticator**. This is preferable to the lost-authenticator route:

1. Sign in and complete the current TOTP challenge so the session is genuinely AAL2.
2. Start replacement; the current verified factor remains active.
3. Have the client scan the new QR code and enter a code from the client-controlled device.
4. Only after that code reaches AAL2 does the server revoke trusted devices, replace the recovery-code set, and delete the previous factor through the Supabase Admin MFA boundary.
5. Give the newly displayed recovery codes directly to the client for secure offline storage. They cannot be retrieved later.
6. Sign out and verify a fresh login using only the client-controlled authenticator.

If recovery-code creation reports that secure recovery storage is unavailable, do not remove either factor. Confirm that migration `202608130008_admin_mfa_recovery.sql` is applied to the target project and that `SUPABASE_SECRET_KEY` is configured only on the server. The application deliberately cannot repair missing production database objects or credentials from the browser.
