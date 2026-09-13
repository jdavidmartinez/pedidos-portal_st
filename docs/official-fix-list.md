# Official technical fix list

Designated by David on 2026-09-10. This is the authoritative list for technical
fixes A01–A13. Update statuses here as work progresses; keep evidence and detailed
completion criteria in [the project audit](project-audit.md). Earlier chat lists
and historical percentage tables do not override this list.

| ID | Task | Status |
| --- | --- | --- |
| A01 | Hide internal errors from customers | Deployed in `3e9c79d`; verified |
| A02 | Protect test-database connections | Deployed in `3e9c79d`; unit, API and browser checks passed |
| A03 | Protect CSV exports from formulas | Deployed in `ac50429`; cloud CI and read-only production checks verified on 2026-09-11 |
| A04 | Add public API limits and Gemini timeout | Implemented and verified locally; migration `0021` applied in Production on 2026-09-13; deployment pending |
| A05 | Correct migration procedures and failure recovery | Partial |
| A06 | Complete critical browser-test coverage | Partial |
| A07 | Record deployment smoke tests and activate alerts | Partial; basic production checks passed for `3e9c79d`, alert activation pending |
| A08 | Standardize error reporting and order-edit auditing | Implemented and verified locally on 2026-09-13; deployment and production-log verification pending |
| A09 | Implement customer-data retention | Implemented and verified locally; migration `0022` applied in Development, Testing and Production on 2026-09-13; deployment and scheduled-run evidence pending |
| A10 | Verify recovery and accessibility | Practical verification pending |
| A11 | Define performance targets and run load tests | Open |
| A12 | Prevent conflicting kitchen edits | Partial |
| A13 | Split large UI files into smaller components | Open; low priority |

## Resume next session

A04 passed 158 unit tests, 12 API/integration tests, 7 browser tests, lint,
TypeScript and a Webpack production build. Migration `0021` is applied in
Development, Testing and Production. Verify `AUTH_SECRET`; the new routes fail
closed without the table or a valid secret. A04 is not committed, pushed or
deployed.
See [the A04 release guide](public-api-limits.md). A05 is the next implementation
task after A04 release work. Native spreadsheet workflow validation for A03
remains pending as documented in the audit.

New product features, including expanded delivery management (domicilios),
belong in a separate feature backlog and are not part of A01–A13. Their scope
has not yet been agreed.

Unrelated local changes to `.gitignore` and `docs/entregables/` belong to David
and must be preserved.
