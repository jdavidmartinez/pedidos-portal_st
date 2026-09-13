import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/db/neon", () => ({
  getSql: () => database,
}));

import {
  anonymizeExpiredOrderData,
  ORDER_RETENTION_CUSTOMER_BATCH_SIZE,
  ORDER_RETENTION_MONTHS,
} from "@/lib/privacy/order-retention";

describe("order data retention", () => {
  beforeEach(() => database.query.mockReset());

  it("anonymizes eligible customer groups in a bounded batch", async () => {
    database.query.mockResolvedValue([{ customers: "2", orders: "5", edits: "3" }]);

    await expect(anonymizeExpiredOrderData()).resolves.toEqual({
      customers: 2,
      orders: 5,
      edits: 3,
    });

    const [statement, parameters] = database.query.mock.calls[0];
    expect(parameters).toEqual([ORDER_RETENTION_MONTHS, ORDER_RETENTION_CUSTOMER_BATCH_SIZE]);
    expect(statement).toContain("MAX(received_at) < now() - make_interval(months => $1)");
    expect(statement).toContain("BOOL_AND(retention_hold_until IS NULL OR retention_hold_until <= now())");
    expect(statement).toContain("pg_try_advisory_xact_lock");
    expect(statement).toContain("LIMIT $2");
    expect(statement).toContain("previous_order = jsonb_build_object('anonymized', TRUE)");
  });

  it("returns zero counts when another run owns the lock or nothing is expired", async () => {
    database.query.mockResolvedValue([{ customers: 0, orders: 0, edits: 0 }]);
    await expect(anonymizeExpiredOrderData()).resolves.toEqual({ customers: 0, orders: 0, edits: 0 });
  });
});
