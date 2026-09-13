# Project audit and delivery tracker

Current A01–A13 statuses are maintained in David's
[official technical fix list](official-fix-list.md), designated on 2026-09-10.
This audit retains the supporting findings and verification evidence.

Audit date: 2026-09-10. Source baseline: `dddebeb` plus the current working tree.

## Assessment

Portal ST has a substantial restaurant-ordering MVP implemented. The next phase
is reliability, verification and operational readiness. This is a source and
local-check audit, not a production certification or an exhaustive security review.
Existing changes to `.gitignore` and `docs/entregables/` were left untouched.

## What exists

| Area | Implemented behavior | Evidence |
| --- | --- | --- |
| Customer ordering | Database-backed menu, individual/combo variants, cart, customer details, consent and confirmation; optional Gemini assistant | `app/menu/page.tsx`, `app/api/menu/route.ts`, `app/api/chat-menu/route.ts` |
| Order persistence | Canonical server prices, atomic order/item creation, idempotency, Colombian phone normalization | `lib/orders/order-repository.ts`, `lib/orders/order-schema.ts` |
| Kitchen | Four-second polling, daily pagination, previous pending orders, editing, delivery fee, state transitions, WhatsApp link and CSV export | `app/cocina/kitchen-client.tsx`, `app/api/orders/` |
| Administration | Products, categories, campaigns, image uploads and orphan cleanup | `app/admin/`, `lib/menu/`, `lib/campaigns/`, `lib/blob/` |
| Access | Admin/kitchen roles, hashed passwords, revocable sessions, login limits, password changes and user management | `lib/auth/`, `app/api/auth/`, `app/api/admin/users/` |
| Infrastructure | Next.js 16.3.0 / React 19.2.4, Neon PostgreSQL, 20 SQL migrations, Vercel Blob and scheduled cleanup | `package.json`, `db/migrations/`, `vercel.json` |
| Quality foundation | Vitest unit/integration suites, five Playwright scenarios and three CI jobs | `tests/`, `.github/workflows/ci.yml` |
| Operations | Structured event helper, webhook support, recovery policy and accessibility checklist | `lib/observability/server.ts`, `docs/` |

Promotions intentionally advertise discounts without changing order prices.
WhatsApp messages are sent manually. Payments and automated WhatsApp delivery
are not part of the documented MVP and are not assumed to be missing requirements.

## Verification performed

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test:unit` | Passed after A04 implementation: 158 tests in 22 files |
| Production build | A04 Webpack build passed locally; default Turbopack passed cloud CI for A03 but was not run locally for A04 |
| API integration | Passed: 12 tests against Neon Testing, including atomic concurrent quota enforcement |
| Playwright | Passed: 7 Chromium scenarios with a dedicated local server and Neon Testing, including chat 429/504 fallback |
| Production, Preview, CI history, provider settings | Not verified in this audit |

## Findings and completion criteria

These findings are based on local source inspection. Infrastructure controls may
exist outside this repository; their absence here does not prove they are absent
in Vercel or Neon. Priority P1 means address before declaring the MVP ready;
P2 means finish as part of delivery hardening; P3 means later maintainability work.

| ID | Priority | Finding and evidence | Done when |
| --- | --- | --- | --- |
| A01 | P1 | Public order creation returns unexpected `error.message` to the caller (`app/api/orders/route.ts`), potentially exposing internal failure details. | Unexpected failures return a generic message; a regression test verifies sensitive sentinel text never appears in the response. |
| A02 | P1 | Test safeguards are weaker than development safeguards. `scripts/run-api-tests.mjs` and `scripts/migrate-test-db.mjs` compare raw URLs against `DATABASE_URL`, ignoring `DEV_DATABASE_URL` and normalized identities. E2E setup/teardown only require a test URL before writing/deleting users. | All test entry points reject protected database identities, including pooled/direct aliases; negative tests prove no connection occurs on mismatch. Validate the disposable target before running API/E2E. |
| A03 | P1 | CSV cells escape quotes but do not neutralize formula prefixes in customer-controlled text (`app/api/orders/export/route.ts`). | Formula-like names, addresses and observations export as literal text; regression cases cover formula prefixes and ordinary values. |
| A04 | P1 | No application rate limit found for public order creation or Gemini. Chat accepts unlimited message/history lengths and its upstream fetch has no explicit timeout (`app/api/chat-menu/route.ts`). | Define and enforce traffic/body/history limits and an upstream timeout, or document verified equivalent infrastructure controls; test rejection and fallback behavior. |
| A05 | P1 | `docs/neon-recovery-policy.md` instructs using `npm run db:migrate` for production, but that alias selects development and refuses Vercel Production. The underlying migration runner executes statements and records the version separately without an enclosing migration transaction. | Correct the runbook, document the exact guarded production procedure, and verify failure/retry behavior on a disposable database without leaving partially applied migrations. |
| A06 | P2 | E2E completion was overstated. The five scenarios cover mocked customer checkout, mobile/keyboard basics, route access and a mocked upload. They do not operate kitchen transitions, export, password changes, product saves or campaign creation through the UI. | Add those critical browser scenarios, retain clear mock boundaries, and record a successful isolated run. |
| A07 | P1 | Smoke-test steps exist but there is no per-deployment result record. Production alerts are explicitly pending in `docs/observability.md`. | Record commit, deployment URL, environment, tester, time, outcomes and defects; verify a controlled alert reaches the intended destination. |
| A08 | P2 | Implemented locally: route failures use sanitized structured reporting, and editing an order and persisting its audit record are one transaction. An audit write failure rolls the edit back. | Deploy and verify sanitized events in Production Runtime Logs. |
| A09 | P2 | Implemented locally: weekly anonymization applies 12 months after each customer's latest order, scrubs order-edit snapshots, supports authorized retention holds and records aggregate counts. | Apply migration `0022`, deploy, and retain evidence from the first successful production run. See [the retention runbook](order-data-retention.md). |
| A10 | P2 | Backup and accessibility policies exist, but this checkout contains no measured recovery drill or current manual assistive-technology/device results. | Record restore verification and measured RPO/RTO; record keyboard, screen-reader, zoom and real-device acceptance results. |
| A11 | P2 | No load-test suite or measured service targets found. Previous pending orders are unpaginated; export reads at most 50,000 orders without reporting truncation. | Define expected traffic and latency/error targets; test polling, order creation and export on synthetic data; bound pending results and make export limits explicit or complete. |
| A12 | P2 | Status checks detect competing status changes, but edits while status remains `received` can overwrite another operator's edit; delivery-fee updates can similarly use stale values (`lib/orders/order-repository.ts`). | Add version/timestamp conflict detection or equivalent locking and concurrent integration tests; rejected stale edits must preserve the winning change. |
| A13 | P3 | Customer and kitchen UI files exceed 1,000 lines each. | Extract cohesive components/hooks after behavior is protected by browser tests. |

## Task list and progress

Progress uses explicit states rather than an unsupported overall percentage.
“Implemented” confirms source exists; “verified locally” confirms this audit's
checks; neither means production has been accepted. All open items below have
completion criteria above or in their linked documents.

| Task | Progress as of audit | Next action |
| --- | --- | --- |
| Core customer, kitchen and admin MVP | Implemented; existing API/E2E suites passed | Complete broader coverage and restaurant acceptance |
| Local lint, types and unit verification | Verified locally: 3/3 checks passed | Preserve results in CI |
| Production build | Verified with Webpack; default Turbopack pending | Confirm default build in CI |
| A01 Public error handling | Deployed in `3e9c79d`; CI and read-only production smoke passed | Monitor operational errors |
| A02 Test environment isolation | Deployed in `3e9c79d`; unit, API and browser verification passed | Preserve safeguards and verified test-only configuration in CI |
| A03 CSV literal-text protection | Deployed in `ac50429`; cloud CI and read-only production checks passed | Validate the restaurant's spreadsheet workflow |
| A04 Public API resource limits | Deployed and smoke-tested in Production on 2026-09-13; valid UI/menu requests returned 200, bounded chat returned 400 and oversized orders returned 413 | Monitor limits and tune them after the A11 performance baseline |
| A05 Migration reliability/runbook | Partial: migrations versioned | Correct procedure and verify failure recovery |
| A06 Browser coverage | Partial: 5 scenarios implemented | Add missing critical operations and run |
| A07 Deployment smoke evidence | Partial: procedure written | Create and complete a release record |
| A07 Production notifications | Partial: webhook code exists | Configure and verify delivery |
| A08 Operational/audit consistency | Deployed; local rollback test and protected-route Production smoke test passed on 2026-09-13 | Verify a sanitized structured event during a controlled or real operational failure |
| A09 Data retention execution | Deployed and verified; `0022` applied in Development, Testing and Production; manual Vercel cron run succeeded on 2026-09-13 with zero records eligible | Review the weekly scheduled run in Vercel Runtime Logs |
| A10 Recovery readiness | Partial: policy and verifier exist | Record isolated recovery drill |
| A10 Accessibility acceptance | Partial: fixes and basic automation exist | Record manual device/assistive checks |
| A11 Performance/capacity | Open; no baseline found | Agree workload and targets, then measure |
| A12 Concurrent operator edits | Partial: status conflict guard exists | Protect same-status edits and test races |
| A13 UI decomposition | Open; optional after delivery gates | Extract components incrementally |
| Restaurant acceptance/sign-off | Unverified | Confirm catalog, delivery rules, promotions and complete order lifecycle with the owner |

Recommended next step: release A04 following its migration sequence, then A05; next A06/A08/A12;
then operational, retention, performance and accessibility evidence before final
restaurant acceptance. Do not add payment or other new features without revisiting scope.

For each future completion, update this table with date, commit and test or
deployment evidence. The old percentage table in `test-plan.md` is historical;
the official fix list is authoritative for current A01–A13 statuses.

## A02 implementation update — 2026-09-10

The original A02 finding above describes the audited baseline; the following
records its remediation and the pre-deployment verification.

- [x] Shared identity guard rejects missing/invalid targets, Vercel Production
  and all known protected database identities. Roles, passwords, query options,
  default-port spelling and Neon pooled/direct aliases cannot disguise a match.
- [x] Apply the guard before connection/client creation in API runner, test
  migrations, direct integration configuration/suite and Playwright config,
  setup and teardown. Local environment sources are checked independently.
- [x] Disable Playwright server reuse so browser tests cannot silently target an
  existing server with an unknown database.
- [x] Validate negative paths and safe configuration: 33 additional unit tests;
  all 82 unit tests, lint, TypeScript and `git diff --check` passed. Webpack
  production build passed with network access.
- [x] Read-only local configuration comparison passed: the configured test
  database differs from all protected identities available locally. No database
  connection was made for this comparison and no secrets were printed.
- [x] Verify read-only connectivity to the configured test database and the
  presence of its migration table. Isolation was checked against all locally
  configured protected endpoints; Neon dashboard branch metadata was not inspected.
- [x] Execute release checks against the existing test-only configuration:
  10 API tests and 5 Chromium scenarios passed on 2026-09-10. All 20 migrations
  were already applied. The shared file reader uses CommonJS so Playwright's
  configuration loader and the ESM API scripts can both load it correctly.

Safeguard sources: `scripts/lib/database-environment.mjs` and
`scripts/lib/test-database-environment.cjs`. Regression coverage:
`tests/unit/test-database-environment.test.ts` and
`tests/unit/test-database-entrypoints.test.ts`. Operational usage and limitations
are documented in the README and test plan. No production credentials need to
be copied locally; configure test secrets only against the verified disposable
branch in CI.

## A01 implementation update — 2026-09-10

- [x] `POST /api/orders` returns a fixed customer-facing message for unexpected
  failures (500) and unavailable database configuration (503), without exposing
  exception messages or environment variable names.
- [x] Preserve specific product/phone validation messages (400), existing status
  codes, no-store headers and sanitized operational reporting.
- [x] Add five regression cases in `tests/unit/order-create-errors.test.ts`:
  Error and non-Error failures containing sensitive sentinel text, missing
  database configuration, and product/phone validation. Tests exercise the real
  route and structured logger with repository creation mocked; no database or
  webhook requests are made.
- [x] Lint, TypeScript, all 87 unit tests, Webpack production build and diff
  whitespace checks passed. Default Turbopack was not rerun.

A01 and A02 are ready for deployment based on the recorded local checks.
Production release status must be verified against the published commit's
GitHub CI and Vercel deployment checks.

## A03 implementation update — 2026-09-10

- [x] Centralize CSV cell encoding in `lib/orders/csv-cell.ts`. Prefix
  formula-like strings with an apostrophe before double-quote escaping. Cover
  ASCII/full-width formula prefixes and leading whitespace/control characters.
- [x] Apply encoding to every export cell, including customer fields, phone
  numbers and campaign names. Keep number values unchanged and null values empty;
  retain UTF-8 BOM, quoted fields and CRLF row endings. Stored order data is not
  modified.
- [x] Add 30 regression cases in `tests/unit/csv-cell.test.ts` and
  `tests/unit/order-export.test.ts`, exercising the real export handler with
  session/repository boundaries mocked. Verify dangerous prefixes, quotes,
  delimiters, multiline values, numeric amounts, response metadata and access.
- [x] Lint, TypeScript, all 117 unit tests, Webpack production build and diff
  whitespace checks passed. No database changes were needed. The previous
  API/E2E results refer to release `3e9c79d`; those suites were not rerun for A03.

The output uses the apostrophe/quoting mitigation described by
[OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection).
CSV has no explicit cell types: spreadsheet programs may display the apostrophe,
and saving/reopening a CSV can strip protective characters. Native Excel or
LibreOffice import/save/reopen behavior was not tested here; the regression tests
verify the exported bytes, not universal spreadsheet compatibility. Validate
the restaurant's actual import workflow before relying on edited CSV copies.

## A03 production verification — 2026-09-11

Commit `ac5042955c8245026ad6fb069e030cf72fb89128` is the current remote master.
Its [Vercel deployment](https://vercel.com/jdavidmartinezs-projects/pedidos-portal-st/C8bqKBfxqzfCytxKvbAmigrvkd4k)
completed successfully, and all three [GitHub CI jobs](https://github.com/jdavidmartinez/pedidos-portal_st/actions/runs/34551862163)
passed, including API integration and Playwright. No additional deployment was needed.

Read-only checks at 2026-09-11 12:40 UTC against
https://pedidos-portal-st.vercel.app passed: `/menu` and `/api/menu` returned 200
(3 categories, 43 products); `/cocina` and `/admin` redirected to login; orders
and CSV export APIs returned 401 without a session. No production orders were
created or modified. Native spreadsheet import/save/reopen testing remains outside
these checks.

## A04 implementation verification — 2026-09-11

See [public API limits and release sequence](public-api-limits.md) for exact
policies, response codes, trusted ingress assumptions and operating limitations.

- [x] Shared Neon quotas: 20 order attempts per 600 seconds and 12 chat attempts
  per 60 seconds. Atomic admission, hashed client buckets, per-route isolation,
  bounded counters, expiry reset and activity-driven stale cleanup.
- [x] Bound actual JSON bytes and upload duration; validate chat message/history
  length, total characters and roles before catalog/Gemini work.
- [x] Abort Gemini at 15 seconds including response-body reads, cap output,
  and return safe errors. Browser errors remain readable and checkout is usable.
- [x] Migrate Development and Testing with `0021_public_api_rate_limits.sql`.
  Production was not migrated.
- [x] Lint, TypeScript, 158 unit tests, 12 API/integration tests, 7 browser tests,
  Webpack production build and `git diff --check` passed. The concurrent quota
  test uses real Neon; Gemini failure/timeout checks use mocks and make no paid
  Gemini requests. Browser recovery is tested with keyboard activation of the
  existing animated confirmation button.
- [ ] Apply migration 0021 to Production/Preview before deploying A04 and verify
  that the existing AUTH_SECRET has at least 16 characters. This implementation
  is not committed, pushed or deployed.
