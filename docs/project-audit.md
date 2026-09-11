# Project audit and delivery tracker

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
| `npm run test:unit` | Passed after A01 implementation: 87 tests in 16 files (5 new public-error regression cases) |
| Production build | `npm run build -- --webpack` passed with network access after A02. Default Turbopack remains unverified due to local process/port restrictions. |
| API integration | Passed: 10 tests against configured Neon Testing after the final guard compatibility correction |
| Playwright | Passed: 5 Chromium scenarios with a dedicated local server and Neon Testing |
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
| A08 | P2 | Several caught failures bypass the structured helper, including order update/export. Order-edit audit insertion runs after the edit transaction and catches failures (`lib/orders/order-repository.ts`). | Route operational failures through sanitized structured reporting and define whether audit persistence is mandatory; test audit failure behavior explicitly. |
| A09 | P2 | The customer notice promises retention up to 12 months after the last order, but no order/customer retention job or documented execution record was found. Order-edit snapshots also contain customer data. | Define and implement a retention workflow consistent with the existing notice, covering orders, audit snapshots and backup handling; verify with synthetic data. This is an implementation gap, not a legal assessment. |
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
| A01 Public error handling | Implemented and verified locally | Deploy and monitor release checks |
| A02 Test environment isolation | Implemented; unit, API and browser verification passed | Preserve safeguards and verified test-only configuration in CI |
| A03 CSV literal-text protection | Open; quote escaping exists | Neutralize formula-like text and test |
| A04 Public API resource limits | Open; login limits already exist separately | Set order/chat policies and implement |
| A05 Migration reliability/runbook | Partial: migrations versioned | Correct procedure and verify failure recovery |
| A06 Browser coverage | Partial: 5 scenarios implemented | Add missing critical operations and run |
| A07 Deployment smoke evidence | Partial: procedure written | Create and complete a release record |
| A07 Production notifications | Partial: webhook code exists | Configure and verify delivery |
| A08 Operational/audit consistency | Partial: helper and edit history exist | Cover remaining errors and audit failures |
| A09 Data retention execution | Partial: notice exists | Implement and validate lifecycle |
| A10 Recovery readiness | Partial: policy and verifier exist | Record isolated recovery drill |
| A10 Accessibility acceptance | Partial: fixes and basic automation exist | Record manual device/assistive checks |
| A11 Performance/capacity | Open; no baseline found | Agree workload and targets, then measure |
| A12 Concurrent operator edits | Partial: status conflict guard exists | Protect same-status edits and test races |
| A13 UI decomposition | Open; optional after delivery gates | Extract components incrementally |
| Restaurant acceptance/sign-off | Unverified | Confirm catalog, delivery rules, promotions and complete order lifecycle with the owner |

Recommended sequence after A01/A02: A03/A04/A05; next A06/A08/A12;
then operational, retention, performance and accessibility evidence before final
restaurant acceptance. Do not add payment or other new features without revisiting scope.

For each future completion, update this table with date, commit and test or
deployment evidence. The old percentage table in `test-plan.md` is historical;
this tracker is the current delivery assessment.

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
