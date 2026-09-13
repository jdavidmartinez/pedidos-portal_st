import "server-only";

import { getSql } from "@/lib/db/neon";

export const ORDER_RETENTION_MONTHS = 12;
export const ORDER_RETENTION_CUSTOMER_BATCH_SIZE = 250;

export interface OrderRetentionResult {
  customers: number;
  orders: number;
  edits: number;
}

/**
 * Anonymize every order for customers whose most recent identifiable order is
 * older than the retention window. The statement uses the database clock and
 * one snapshot, and a transaction advisory lock prevents overlapping runs.
 */
export async function anonymizeExpiredOrderData(): Promise<OrderRetentionResult> {
  const rows = await getSql().query(
    `WITH retention_lock AS (
       SELECT pg_try_advisory_xact_lock(hashtext('portal-pedidos:order-retention')) AS acquired
     ),
     eligible_customers AS (
       SELECT customer_phone
       FROM orders
       WHERE anonymized_at IS NULL
         AND (SELECT acquired FROM retention_lock)
       GROUP BY customer_phone
       HAVING MAX(received_at) < now() - make_interval(months => $1)
         AND BOOL_AND(retention_hold_until IS NULL OR retention_hold_until <= now())
       ORDER BY MAX(received_at)
       LIMIT $2
     ),
     target_orders AS MATERIALIZED (
       SELECT o.id
       FROM orders o
       JOIN eligible_customers c USING (customer_phone)
       WHERE o.anonymized_at IS NULL
     ),
     scrubbed_edits AS (
       UPDATE order_edits e
       SET reason = NULL,
           previous_order = jsonb_build_object('anonymized', TRUE),
           updated_order = jsonb_build_object('anonymized', TRUE)
       FROM target_orders t
       WHERE e.order_id = t.id
       RETURNING e.id
     ),
     scrubbed_orders AS (
       UPDATE orders o
       SET customer_name = 'Cliente anonimizado',
           customer_address = 'Información anonimizada',
           customer_phone = '570000000000',
           observations = NULL,
           idempotency_key = NULL,
           retention_hold_until = NULL,
           retention_hold_reason = NULL,
           anonymized_at = now(),
           updated_at = now()
       FROM target_orders t
       WHERE o.id = t.id
       RETURNING o.id
     )
     SELECT
       (SELECT COUNT(*)::int FROM eligible_customers) AS customers,
       (SELECT COUNT(*)::int FROM scrubbed_orders) AS orders,
       (SELECT COUNT(*)::int FROM scrubbed_edits) AS edits`,
    [ORDER_RETENTION_MONTHS, ORDER_RETENTION_CUSTOMER_BATCH_SIZE],
    {
      arrayMode: false,
      fullResults: false,
      fetchOptions: { signal: AbortSignal.timeout(30_000) },
    }
  ) as unknown as Array<{ customers: number | string; orders: number | string; edits: number | string }>;

  return {
    customers: Number(rows[0]?.customers ?? 0),
    orders: Number(rows[0]?.orders ?? 0),
    edits: Number(rows[0]?.edits ?? 0),
  };
}
