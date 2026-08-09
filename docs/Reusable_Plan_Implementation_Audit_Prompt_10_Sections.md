# Reusable Codex Prompt — Plan vs Implementation Audit

## 1. Read the Plan First

You are acting as a senior software architect, QA engineer, security reviewer, SEO reviewer and implementation auditor.

Audit the current repository against:

```text
PLAN_FILE={{PATH_TO_IMPLEMENTATION_PLAN}}
```

Before changing code:

- read the full plan/specification
- extract all requirements
- identify all MUST / MUST NOT / REQUIRED / CRITICAL rules
- identify Phase 1 requirements
- identify Definition of Done requirements
- identify prohibited features
- identify required routes, integrations, data models and user journeys

Treat the plan as the primary source of truth.

Do not assume a feature is complete because a file, component, route, package or TODO exists.

---

## 2. Inspect the Full Repository

Review the actual implementation across:

```text
src/
app/
pages/
components/
lib/
services/
api/
server/
database/
prisma/
supabase/
public/
styles/
tests/
docs/
scripts/
package.json
.env.example
deployment/config files
```

Determine:

- framework and runtime
- routing architecture
- database
- APIs
- third-party integrations
- environment configuration
- deployment setup
- test setup

Search for incomplete work:

```text
TODO
FIXME
HACK
TEMP
PLACEHOLDER
MOCK
dummy
coming soon
not implemented
example.com
localhost
console.log
```

Also identify dead code, duplicate implementations, unused dependencies and hardcoded configuration.

---

## 3. Build a Requirements Traceability Matrix

Create one row for every meaningful requirement.

Use:

| ID | Requirement | Status | Evidence | Problem | Required Action |
|---|---|---|---|---|---|
| R001 | Example | ✅ Complete | `src/...` | None | None |
| R002 | Example | 🟡 Partial | `src/...` | Missing validation | Fix |
| R003 | Example | 🔴 Missing | None | Not implemented | Build |
| R004 | Example | ⚠️ Incorrect | `src/...` | Violates plan | Refactor |

Allowed statuses:

```text
✅ COMPLETE
🟡 PARTIAL
🔴 MISSING
⚠️ INCORRECT
🚫 VIOLATES PLAN
🧪 PRESENT BUT UNVERIFIED
```

Every status must include real evidence such as:

```text
file path
component/function
route
schema
environment variable
test
configuration
```

Never mark a requirement complete without locating and verifying the actual implementation.

---

## 4. Verify Core Functionality End-to-End

Audit all required user journeys from start to finish.

For each journey verify:

```text
entry point
UI
validation
state handling
API/server call
database/integration
success state
error state
retry/fallback
navigation to next step
mobile behaviour
```

Example format:

```text
Journey: Vehicle Lookup → Booking

1. Registration input         PASS
2. Validation                 PASS
3. API request                PASS
4. Vehicle response           FAIL
5. State persistence          PARTIAL
6. Booking handoff            FAIL
```

A feature is not complete if only the frontend exists.

Also audit:

- required routes
- navigation
- CTAs
- forms
- APIs
- database writes
- third-party integrations
- environment variables

Flag features that exist but are not actually wired together.

---

## 5. Audit Technical Quality

Review the implementation for:

### Security

```text
secret exposure
server/client boundaries
input validation
rate limiting
authentication/authorisation
unsafe uploads
XSS
injection risk
PII handling
logging
open redirects
```

### Privacy

Check whether sensitive data is:

```text
stored unnecessarily
placed in URLs
sent to analytics
logged
sent to third parties
retained unnecessarily
```

### Performance

Review:

```text
Server vs Client Components
bundle size
third-party scripts
image optimisation
font loading
lazy loading
code splitting
unnecessary hydration
API waterfalls
database queries
caching
```

### Accessibility

Check:

```text
semantic HTML
heading hierarchy
labels
keyboard navigation
focus states
contrast
alt text
ARIA
forms
errors
reduced motion
```

Classify findings by severity.

---

## 6. Audit SEO, Content and Design

For public/marketing websites verify:

```text
title
meta description
canonical
robots
sitemap
OpenGraph
structured data
breadcrumbs
H1
server rendering
internal links
indexability
image alt text
URL structure
```

Create a page matrix where useful:

| Page | Title | Description | Canonical | Schema | H1 | Indexable | Issues |
|---|---:|---:|---:|---:|---:|---:|---|

Also inspect content for:

```text
placeholder text
fake testimonials
fake reviews
fake statistics
unsupported claims
copied competitor content
duplicate content
incorrect business details
keyword stuffing
thin SEO pages
```

Verify the design follows the plan:

```text
brand colours
typography
spacing
button hierarchy
responsive behaviour
mobile navigation
loading/error states
component reuse
```

---

## 7. Verify Business Rules and Forbidden Features

Extract all project-specific business rules from the plan and verify each one.

Examples:

```text
feature must be server-side
data must not appear in URLs
service is outsourced
pricing must use ranges
integration must lazy-load
data must not be stored
specific feature must never exist
```

Perform a dedicated prohibited-feature scan across:

```text
routes
navigation
components
content
metadata
schema
database
API responses
tests
environment variables
```

Any violation must be reported as:

```text
🚫 VIOLATES PLAN
```

Do not silently ignore or reinterpret explicit business rules.

---

## 8. Run Build, Tests and Validation

Run the appropriate project commands, for example:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Also run relevant integration/E2E tests if available.

Report the exact status:

```text
Build: PASS / FAIL
Lint: PASS / FAIL
Typecheck: PASS / FAIL
Tests: PASS / FAIL
E2E: PASS / FAIL
```

Do not:

- disable tests to get green CI
- weaken TypeScript to hide errors
- add `any` everywhere
- swallow exceptions
- hide compiler errors
- fabricate successful test results

Also identify required tests that are missing.

---

## 9. Produce the Audit Report and Completion Plan

Return:

### Executive Summary

```text
Implementation completeness: X%

P0 Blockers: X
P1 Critical: X
P2 Important: X
P3 Improvements: X

Build:
Lint:
Typecheck:
Tests:
E2E:
```

Calculate completeness from the requirements matrix.

Suggested weighting:

```text
Complete = 1
Partial = 0.5
Missing / Incorrect / Violates Plan = 0
```

Then provide:

1. Full requirements matrix
2. P0/P1 blockers first
3. Core user journey PASS/FAIL results
4. Missing/incorrect routes
5. API and integration status
6. SEO/content/design issues
7. Security/privacy issues
8. Test coverage gaps
9. Placeholder/dead-code issues
10. Ordered completion plan

Order fixes by:

```text
Blockers
Dependencies
Core functionality
Business rules
Security
SEO
UX
Polish
```

Do not change code until the complete audit is finished unless explicitly instructed.

---

## 10. Fix Mode and Final Re-Audit

If instructed to implement the fixes:

1. Fix P0 issues first
2. Fix P1 issues
3. Run focused tests
4. Fix P2 issues
5. Run tests again
6. Address P3 where safe
7. Run full lint/typecheck/tests/build
8. Re-read the original plan
9. Re-audit the repository from scratch
10. Produce the final requirements matrix

For critical defects, add regression tests.

Never mark something complete simply because code was added.

Verify it works.

Final report:

```text
Implementation completeness: X%

P0: 0
P1: 0
P2: X
P3: X

Build: PASS / FAIL
Lint: PASS / FAIL
Typecheck: PASS / FAIL
Tests: PASS / FAIL
E2E: PASS / FAIL
```

Then choose one:

```text
NOT READY
READY WITH CONDITIONS
READY FOR STAGING
READY FOR PRODUCTION
```

Explain any remaining gaps.

---

# Usage

## Audit Only

```text
Audit this repository against the implementation plan.

PLAN_FILE=./path/to/plan.md

Do the complete audit first.
Do not change code yet.

Return:
- requirements matrix
- implementation completeness percentage
- evidence for every status
- severity-ranked gaps
- core journey results
- build/test status
- ordered completion plan
```

## Fix After Audit

```text
Now implement the completion plan.

Start with P0 and P1 issues.
Work incrementally.
Run tests after each major change.

When finished, re-run the full plan-vs-implementation audit
and provide the final requirements matrix and production-readiness verdict.
```

## Final Strict Check

```text
Do not trust previous completion claims.

Re-read PLAN_FILE from the beginning and audit the repository again from scratch.

For every requirement:
1. locate implementation evidence
2. verify it is wired into the product
3. verify correct behaviour
4. verify error/failure states
5. verify tests where required

Anything without evidence must not be marked complete.

Return the final traceability matrix, calculated completeness percentage,
remaining deviations and production-readiness verdict.
```
