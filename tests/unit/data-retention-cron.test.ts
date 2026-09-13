import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const retention = vi.hoisted(() => ({ anonymizeExpiredOrderData: vi.fn() }));

vi.mock("@/lib/privacy/order-retention", () => retention);

import { GET } from "@/app/api/cron/data-retention/route";

function cronRequest(secret?: string) {
  return new Request("http://test.local/api/cron/data-retention", {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("scheduled order-retention route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-test-secret";
    retention.anonymizeExpiredOrderData.mockReset();
  });

  afterEach(() => delete process.env.CRON_SECRET);

  it("fails closed when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(cronRequest());
    expect(response.status).toBe(503);
    expect(retention.anonymizeExpiredOrderData).not.toHaveBeenCalled();
  });

  it("rejects an invalid bearer token", async () => {
    const response = await GET(cronRequest("wrong-secret"));
    expect(response.status).toBe(401);
    expect(retention.anonymizeExpiredOrderData).not.toHaveBeenCalled();
  });

  it("returns only aggregate counts after an authorized run", async () => {
    retention.anonymizeExpiredOrderData.mockResolvedValue({ customers: 2, orders: 5, edits: 3 });
    const response = await GET(cronRequest("cron-test-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, customers: 2, orders: 5, edits: 3 });
  });

  it("does not expose an internal failure", async () => {
    retention.anonymizeExpiredOrderData.mockRejectedValue(new Error("database details"));
    const response = await GET(cronRequest("cron-test-secret"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "No fue posible completar la retención programada." });
  });
});
