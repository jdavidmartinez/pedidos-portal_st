import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getTestDatabaseUrl } from "../../scripts/lib/test-database-environment.cjs";
import { consumePublicRateLimit, publicRateKey, PUBLIC_RATE_POLICIES } from "@/lib/http/public-rate-limit";

const databaseUrl = getTestDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;
const sql = neon(databaseUrl);
const run = randomUUID().replaceAll("-", "");
const request = new Request("http://test", { headers: { "x-vercel-forwarded-for": `2001:db8:${run.slice(0, 4)}:${run.slice(4, 8)}::1` } });
let orderKey = "";
let chatKey = "";
const staleKey = `test-expired-${run}`;

beforeAll(() => {
  vi.stubEnv("VERCEL", "1");
  orderKey = publicRateKey("orders", request);
  chatKey = publicRateKey("chat", request);
});
afterAll(async () => {
  try { await sql`DELETE FROM public_api_rate_limits WHERE bucket_key IN (${orderKey}, ${chatKey}, ${staleKey})`; }
  finally { vi.unstubAllEnvs(); }
});

it("enforces a shared atomic quota under concurrent requests, then resets on expiry", async () => {
  // Warm the compute before the parallel burst; this first arrival consumes one slot.
  await consumePublicRateLimit("orders", request);
  const count = PUBLIC_RATE_POLICIES.orders.limit;
  const results = await Promise.allSettled(Array.from({ length: count + 5 }, () => consumePublicRateLimit("orders", request)));
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(count - 1);
  const denied = results.filter(result => result.status === "rejected");
  expect(denied).toHaveLength(6);
  for (const result of denied) if (result.status === "rejected") {
    expect(result.reason).toMatchObject({ status: 429 });
    expect(result.reason.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.reason.retryAfterSeconds).toBeLessThanOrEqual(600);
  }
  const rows = await sql`SELECT request_count, expires_at FROM public_api_rate_limits WHERE bucket_key = ${orderKey}`;
  expect(rows[0].request_count).toBe(count + 1);
  // Different endpoint quota stays independent.
  await expect(consumePublicRateLimit("chat", request)).resolves.toBeUndefined();
  await sql`UPDATE public_api_rate_limits SET expires_at = now() - interval '1 second' WHERE bucket_key = ${orderKey}`;
  await expect(consumePublicRateLimit("orders", request)).resolves.toBeUndefined();
  const reset = await sql`SELECT request_count FROM public_api_rate_limits WHERE bucket_key = ${orderKey}`;
  expect(reset[0].request_count).toBe(1);
});

it("cleans stale hashed counters without clearing active quotas", async () => {
  await sql`INSERT INTO public_api_rate_limits (bucket_key, request_count, expires_at) VALUES (${staleKey}, 1, now() - interval '2 days')`;
  await consumePublicRateLimit("chat", request);
  expect(await sql`SELECT bucket_key FROM public_api_rate_limits WHERE bucket_key = ${staleKey}`).toHaveLength(0);
  expect(await sql`SELECT bucket_key FROM public_api_rate_limits WHERE bucket_key = ${orderKey}`).toHaveLength(1);
});
