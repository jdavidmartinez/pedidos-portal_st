import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { consumePublicRateLimit, publicRateKey } from "@/lib/http/public-rate-limit";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db/neon", () => ({ getSql: () => ({ query }) }));

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-only-secret-for-public-limit");
  vi.stubEnv("VERCEL", "1");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  query.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const request = (ip: string) => new Request("http://test", { headers: { "x-vercel-forwarded-for": ip } });

it("hashes client identities and separates endpoints", () => {
  const key = publicRateKey("orders", request("192.0.2.1"));
  expect(key).toMatch(/^[a-f0-9]{64}$/);
  expect(key).not.toContain("192.0.2.1");
  expect(key).not.toBe(publicRateKey("chat", request("192.0.2.1")));
  expect(key).not.toBe(publicRateKey("orders", request("192.0.2.2")));
});
it("normalizes IPv6 spelling, /64 privacy addresses and IPv4 mapped addresses", () => {
  expect(publicRateKey("chat", request("2001:db8:0:1::1"))).toBe(publicRateKey("chat", request("2001:0db8:0000:0001::abcd")));
  expect(publicRateKey("chat", request("::ffff:192.0.2.1"))).toBe(publicRateKey("chat", request("192.0.2.1")));
});
it("ignores spoofable forwarding headers outside Vercel", () => {
  vi.stubEnv("VERCEL", "");
  expect(publicRateKey("orders", request("192.0.2.1"))).toBe(publicRateKey("orders", request("192.0.2.2")));
});
it("groups missing, malformed and multi-address headers in the fallback bucket", () => {
  const fallback = publicRateKey("orders", request(""));
  for (const ip of ["anything", "192.0.2.1, 192.0.2.2"]) expect(publicRateKey("orders", request(ip))).toBe(fallback);
});
it("allows the last request and returns a retry interval on exhaustion", async () => {
  query.mockResolvedValueOnce([{ request_count: 20, retry_after: 42 }]);
  await expect(consumePublicRateLimit("orders", request("192.0.2.1"))).resolves.toBeUndefined();
  query.mockResolvedValueOnce([{ request_count: 21, retry_after: 41 }]);
  await expect(consumePublicRateLimit("orders", request("192.0.2.1"))).rejects.toMatchObject({ status: 429, retryAfterSeconds: 41 });
});
it("fails closed and hides store failures", async () => {
  query.mockRejectedValue(new Error("postgres://private-sentinel"));
  await expect(consumePublicRateLimit("orders", request("192.0.2.1"))).rejects.toMatchObject({ status: 503 });
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-sentinel");
});
it("fails closed before connecting when AUTH_SECRET is missing", async () => {
  vi.stubEnv("AUTH_SECRET", "");
  await expect(consumePublicRateLimit("chat", request("192.0.2.1"))).rejects.toMatchObject({ status: 503 });
  expect(query).not.toHaveBeenCalled();
});
