# High-intent article draft import

These four `.article-source` files preserve the reviewed editorial material
from the rejected publication migrations. They are deliberately
non-executable: they contain no `INSERT`, publication status, or publication
date. The importer converts every new article to the existing CMS model and
validates it with `contentEntrySchema` before any database operation.

Run a read-only plan:

```powershell
pnpm articles:import -- --dry-run
```

The plan reports `NEW_DRAFT`, `ENHANCEMENT_CANDIDATE`,
`EXISTING_EXACT_SLUG`, and `POTENTIAL_CONTENT_COLLISION`. Dry-run uses a
read-only CMS query and performs no writes.

The two mapped enhancement candidates preserve these existing canonicals:

- `engine-warning-light-what-it-means` → `what-engine-management-light-means`
- `car-battery-keeps-going-flat-overnight` → `why-car-battery-keeps-going-flat`

Their proposed content is retained here for an editor to compare with the
published article. The importer never updates either row.

Apply mode calls the transactional `import_article_drafts` RPC and imports
only `NEW_DRAFT` rows. The supported production workflow is the protected
**Admin → News & Blog → High-intent article import** control. It reuses the
signed-in administrator's cookie session, runs a fresh preview, requires an
explicit draft-only confirmation, and never exposes or copies the user's JWT.

The command-line apply mode remains available for isolated development or
recovery testing. It requires an authenticated CMS-admin access token in
`ARTICLE_IMPORT_ADMIN_ACCESS_TOKEN` and an explicit target environment:

```powershell
pnpm articles:import -- --apply --environment local
```

Production apply is intentionally double-confirmed. It additionally requires
both:

```text
--confirm-production=IMPORT_REVIEWED_DRAFTS
ARTICLE_IMPORT_PRODUCTION_APPROVED=IMPORT_REVIEWED_DRAFTS
```

Possessing production credentials is not consent to apply. The CLI is not the
normal production operator workflow; do not set these confirmations unless a
separate recovery operation has been explicitly authorised. Publication and
scheduling remain manual Admin → News & Blog actions.
