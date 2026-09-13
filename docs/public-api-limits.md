# A04 — Public API limits and Gemini timeout

Implemented 2026-09-11. These are initial operating defaults; tune them using
observed restaurant traffic and the A11 performance baseline.

| Control | Value |
| --- | --- |
| `POST /api/orders` | 20 attempts per 10 minutes per client bucket |
| `POST /api/chat-menu` | 12 attempts per minute per client bucket |
| JSON request body, both routes | 96 KiB of actual UTF-8 bytes |
| Reading the request body | 10 seconds |
| Current chat message | 8,000 characters |
| History | At most 12 messages, at most 4,000 characters each |
| Current message plus history | At most 16,000 characters |
| Neon admission query | 5-second HTTP timeout |
| Gemini request and response body | 15-second abort timeout |
| Gemini generation | 1,024 output tokens; thinking budget 0 |
| Browser chat request | 25-second timeout, with a readable fallback |

## Admission and persistence

`lib/http/public-rate-limit.ts` stores HMAC-SHA256 bucket keys and counters in
Neon. It uses the existing `AUTH_SECRET` (at least 16 characters); it does not
store raw IP addresses. Each scope has an independent quota. An atomic upsert
uses the database clock so concurrent requests and separate Vercel instances
share the same limit. Windows begin with the first arrival; this is a fixed
window, not a rolling-window or global traffic limit. Denials do not extend the
window, and counters stop growing after the first denied attempt.

All attempts count, including validation failures and idempotent order retries.
The existing order idempotency behavior is preserved for admitted requests.
Kitchen polling and authenticated administration do not use these public quotas.

On Vercel (`VERCEL=1`), the limiter accepts only `x-vercel-forwarded-for` with a
single valid IP. It ignores client-supplied alternatives such as `x-real-ip`.
IPv6 spellings are canonicalized and privacy addresses share a /64 bucket;
IPv4-mapped IPv6 uses the same bucket as IPv4. Missing/invalid addresses and
non-Vercel deployments share a fallback bucket. Other hosting arrangements need
an explicitly trusted ingress integration before enabling per-client identity.
Several customers behind the same public IP also share a quota.

Each admission removes up to 100 counters expired more than a day ago, using an
expiry index and skipping locked rows. Cleanup is activity-driven: when traffic
stops, stale hashed counters remain until subsequent requests clean them up.
The limiter is application protection; it does not replace ingress DDoS controls
or provider budget limits against clients rotating across many IPs.

## Responses and customer experience

- `429` includes `Retry-After` in seconds and a Spanish retry message.
- `413` rejects oversized payloads, even when Content-Length is absent or false.
- `408` cancels a stalled request-body read.
- `400` rejects invalid JSON, chat roles, missing/empty messages or exceeded
  message/history limits before reading the catalog or contacting Gemini.
- `503` rejects requests when admission cannot be verified, including an absent
  rate-limit table or invalid secret. It does not bypass the limiter on failure.
- Gemini failures return `502`; timeouts return `504`. Internal exception text
  stays out of responses. Logs use sanitized operational events.

All these responses use `Cache-Control: no-store`. The chat client keeps only
recent history within the same limits, caps manual input length and renders
errors as readable messages. After a chat failure the customer can still open
the delivery form and send the selected order directly.

## Migration and release sequence

Apply additive migration `0021_public_api_rate_limits.sql` before enabling the
new application version in each environment. It creates a separate table/index
and does not change existing order records.

- Testing: `npm run test:api` applies migrations using the test isolation guard.
- Development: `npm run db:migrate:dev` uses the development isolation guard.
- Production/Preview: apply `0021` using the intended environment's established
  migration mechanism and verify the table/index before deploying A04. Confirm
  `AUTH_SECRET` is configured. Do not use `npm run db:migrate` for production:
  that alias selects development (the runbook correction remains A05).

An old application version can run with the added table, so apply the migration
before the deployment and leave it in place if rolling the application back.
Migration `0021` was applied in Production on 2026-09-13. Deployment remains
pending.

## Verification

On 2026-09-11, migration 0021 was applied to Development and Testing. Lint,
TypeScript, 158 unit tests, 12 API/integration tests, 7 browser tests and the
Webpack production build passed. Production migration and deployment are pending.

- Unit tests exercise IP hashing/canonicalization, quota responses, safe failure,
  bounded streams, Unicode byte sizes, upload deadlines, chat schema, upstream
  failure/timeouts (including a stalled response body), and browser helper errors.
- Neon integration tests send concurrent arrivals, verify the exact admission
  count, scope isolation, expiry reset, bounded counters and stale cleanup.
- API tests use an isolated client bucket per run and remove it during cleanup.
- Browser tests mock Gemini 429/504 responses and verify checkout stays usable;
  no paid Gemini call is needed for these checks.

Sources: [Vercel request headers](https://vercel.com/docs/headers/request-headers),
[Gemini thinking configuration](https://ai.google.dev/gemini-api/docs/generate-content/thinking?hl=en).
