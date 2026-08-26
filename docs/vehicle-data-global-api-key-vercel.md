# Vehicle Data Global API key deployment

## Task

Keep the `VEHICLE_DATA_GLOBAL_API_KEY` used by the production SOB Autofix site in sync with the current Vehicle Data Global credential.

The credential is a server-side secret. Its value must never be written to this document, committed to Git, printed in logs, added to a public environment variable, or exposed to browser code.

## Current status

The production update has been completed:

- Vercel project: `sobautofix`
- Environment variable: `VEHICLE_DATA_GLOBAL_API_KEY`
- Scope: Production
- Type: Secret
- Production deployment: Redeployed successfully after the update
- Live site: [sobautofix.com](https://sobautofix.com)

The local value remains in `.env.local`, which is ignored by Git. The secret itself was not displayed or committed.

## What needs to be done for future key changes

1. Obtain the replacement API key from Vehicle Data Global through an approved secure channel.
2. Replace the local `VEHICLE_DATA_GLOBAL_API_KEY` value in `.env.local` without removing the variable name.
3. Confirm `.env.local` is still ignored by Git before staging or committing any repository changes.
4. In the linked Vercel project, overwrite `VEHICLE_DATA_GLOBAL_API_KEY` for the Production environment.
5. Preserve the variable as a Vercel Secret. Do not convert it to a readable Config value.
6. Redeploy Production so the running application receives the new value. Updating a Vercel environment variable does not change an already-built deployment.
7. Wait for the deployment to reach `Ready` and confirm the production domain is still aliased to [sobautofix.com](https://sobautofix.com).
8. Run a controlled vehicle lookup on the production site and confirm the provider responds successfully.
9. If the old credential was rotated or suspected to be exposed, revoke it with Vehicle Data Global after the new production deployment has been verified.

Preview and Development should only receive the credential when those environments need live provider access and the access has been explicitly approved. Otherwise, keep the secret scoped to Production.

## Safe Vercel CLI procedure

The repository is linked through `.vercel/project.json`. Use a local authenticated Vercel CLI session and pass the secret through standard input so it does not appear in shell history or process arguments.

```powershell
$entry = Get-Content -LiteralPath '.env.local' |
  Where-Object { $_ -match '^VEHICLE_DATA_GLOBAL_API_KEY=' } |
  Select-Object -Last 1

$apiValue = ($entry -split '=', 2)[1]
$apiValue | npx vercel env add VEHICLE_DATA_GLOBAL_API_KEY production --force --sensitive
```

Do not echo `$apiValue`, use `--value` with the secret on the command line, or paste the credential into a committed script.

After the environment update, redeploy the latest successful Production deployment:

```powershell
npx vercel ls sobautofix --prod
npx vercel redeploy <latest-production-deployment-url> --target production
```

## Verification checklist

- Vercel reports `VEHICLE_DATA_GLOBAL_API_KEY` as `Secret` in `Production`.
- The new production deployment reaches `Ready` without build or runtime errors.
- `https://sobautofix.com` resolves to the new deployment.
- A controlled vehicle lookup succeeds on the live site.
- Failed lookup logs do not contain the API key or full authorization details.
- `git status` does not show `.env.local` or any file containing the credential.

## Rollback

If production lookups fail after rotation:

1. Confirm the new value was copied completely and does not contain surrounding quotes or unintended whitespace.
2. Restore the last known-good credential as the Production secret, if it is still valid.
3. Redeploy Production again.
4. Verify a controlled lookup before revoking either credential.
5. If neither credential works, disable or contain the failing provider path as appropriate and contact Vehicle Data Global support without sharing credentials in tickets or public logs.

