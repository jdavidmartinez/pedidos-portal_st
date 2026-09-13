import { afterAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { getTestDatabaseUrl } from "../../scripts/lib/test-database-environment.cjs";

const databaseUrl = getTestDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;

import { anonymizeExpiredOrderData } from "@/lib/privacy/order-retention";

const sql = neon(databaseUrl);
const ids = {
  expiredOne: randomUUID(),
  expiredTwo: randomUUID(),
  recentOld: randomUUID(),
  recentNew: randomUUID(),
  held: randomUUID(),
  expiredHold: randomUUID(),
};

async function insertOrder(
  id: string,
  phone: string,
  receivedAt: string,
  holdUntil?: string,
) {
  await sql`
    INSERT INTO orders (
      id, customer_name, customer_address, customer_phone,
      subtotal, delivery_fee, total, status, observations,
      idempotency_key, data_consent_at, data_consent_version,
      received_at, updated_at, retention_hold_until, retention_hold_reason
    ) VALUES (
      ${id}, ${`Retention ${id}`}, ${`Address ${id}`}, ${phone},
      10000, 2000, 12000, 'dispatched', ${`Observation ${id}`},
      ${`retention-${id}`}, ${receivedAt}, 'v3',
      ${receivedAt}, ${receivedAt}, ${holdUntil ?? null},
      ${holdUntil ? "LEGAL_CASE_TEST" : null}
    )
  `;
}

afterAll(async () => {
  await sql`DELETE FROM orders WHERE id = ANY(${Object.values(ids)})`;
});

describe("customer-data retention against Neon", () => {
  it("anonymizes expired customers, scrubs edit snapshots, and respects active holds", async () => {
    const old = "2024-01-15T12:00:00.000Z";
    const recent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const past = "2025-01-01T00:00:00.000Z";

    await insertOrder(ids.expiredOne, "579990000001", old);
    await insertOrder(ids.expiredTwo, "579990000001", "2024-02-15T12:00:00.000Z");
    await insertOrder(ids.recentOld, "579990000002", old);
    await insertOrder(ids.recentNew, "579990000002", recent);
    await insertOrder(ids.held, "579990000003", old, future);
    await insertOrder(ids.expiredHold, "579990000004", old, past);
    await sql.query(
      `INSERT INTO order_edits (order_id, reason, previous_order, updated_order, created_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)`,
      [
        ids.expiredOne,
        "Customer changed address",
        JSON.stringify({ customer: { name: "Private previous", address: "Private address" } }),
        JSON.stringify({ customer: { name: "Private updated", phone: "579990000001" } }),
        old,
      ],
    );

    const result = await anonymizeExpiredOrderData();
    expect(result.customers).toBeGreaterThanOrEqual(2);
    expect(result.orders).toBeGreaterThanOrEqual(3);
    expect(result.edits).toBeGreaterThanOrEqual(1);

    const anonymized = await sql`
      SELECT id, customer_name, customer_address, customer_phone, observations,
             idempotency_key, data_consent_at, data_consent_version, anonymized_at,
             retention_hold_until, retention_hold_reason
      FROM orders
      WHERE id = ANY(${[ids.expiredOne, ids.expiredTwo, ids.expiredHold]})
      ORDER BY id
    `;
    expect(anonymized).toHaveLength(3);
    for (const order of anonymized) {
      expect(order).toMatchObject({
        customer_name: "Cliente anonimizado",
        customer_address: "Información anonimizada",
        customer_phone: "570000000000",
        observations: null,
        idempotency_key: null,
        data_consent_version: "v3",
        retention_hold_until: null,
        retention_hold_reason: null,
      });
      expect(order.data_consent_at).toBeTruthy();
      expect(order.anonymized_at).toBeTruthy();
    }

    const edit = await sql`
      SELECT reason, previous_order, updated_order
      FROM order_edits WHERE order_id = ${ids.expiredOne}
    `;
    expect(edit).toEqual([{ reason: null, previous_order: { anonymized: true }, updated_order: { anonymized: true } }]);

    const preserved = await sql`
      SELECT id, customer_phone, anonymized_at
      FROM orders WHERE id = ANY(${[ids.recentOld, ids.recentNew, ids.held]})
    `;
    expect(preserved).toHaveLength(3);
    expect(preserved.every((order) => order.anonymized_at === null)).toBe(true);
    expect(new Set(preserved.map((order) => order.customer_phone))).toEqual(
      new Set(["579990000002", "579990000003"]),
    );

    const secondRun = await anonymizeExpiredOrderData();
    expect(secondRun.orders).toBeGreaterThanOrEqual(0);
    const stillAnonymized = await sql`
      SELECT COUNT(*)::int AS count FROM orders
      WHERE id = ANY(${[ids.expiredOne, ids.expiredTwo, ids.expiredHold]})
        AND anonymized_at IS NOT NULL
    `;
    expect(stillAnonymized[0].count).toBe(3);
  });
});
