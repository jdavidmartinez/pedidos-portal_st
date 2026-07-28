import "server-only";

import { randomUUID } from "node:crypto";
import { MENU_PORTAL } from "@/app/menu/data";
import { getSql } from "@/lib/db/neon";
import type {
  CreateOrderInput,
  Order,
  OrderItem,
  OrderStatus,
  UpdateOrderInput,
} from "@/types/order";

export interface OrderRepository {
  create(input: CreateOrderInput): Promise<Order>;
  list(): Promise<Order[]>;
  update(id: string, input: UpdateOrderInput): Promise<Order>;
}

export class OrderNotFoundError extends Error {}
export class InvalidOrderTransitionError extends Error {}
export class InvalidOrderItemError extends Error {}
export class InvalidCustomerPhoneError extends Error {}

interface OrderRow {
  id: string;
  number: number | string;
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  subtotal: number | string;
  delivery_fee: number | string | null;
  total: number | string;
  observations: string | null;
  status: OrderStatus;
  received_at: string;
  updated_at: string;
  completed_at: string | null;
  items: unknown;
}

interface CurrentOrderRow {
  id: string;
  status: OrderStatus;
  delivery_fee: number | string | null;
  subtotal: number | string;
  completed_at: string | null;
}

const productsByName = new Map(
  Object.values(MENU_PORTAL)
    .flat()
    .map((product) => [product.nombre, product] as const)
);

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  received: ["accepted", "rejected"],
  accepted: ["preparing", "rejected"],
  preparing: ["dispatched", "rejected"],
  dispatched: [],
  rejected: [],
};

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10 && digits.startsWith("3")) {
    return `57${digits}`;
  }

  if (digits.length === 10) {
    throw new InvalidCustomerPhoneError(
      "El celular colombiano debe comenzar por 3."
    );
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }

  throw new InvalidCustomerPhoneError(
    "El teléfono debe incluir un número celular válido."
  );
}

function buildItems(input: CreateOrderInput): OrderItem[] {
  const quantities = new Map<string, number>();

  for (const item of input.items) {
    quantities.set(item.name, (quantities.get(item.name) ?? 0) + item.quantity);
  }

  return Array.from(quantities, ([name, quantity]) => {
    const product = productsByName.get(name);
    if (!product) {
      throw new InvalidOrderItemError(`El producto "${name}" no existe en el menú.`);
    }

    return {
      name,
      quantity,
      unitPrice: product.precioIndividual,
      lineTotal: product.precioIndividual * quantity,
    };
  });
}

function toNumber(value: number | string) {
  return Number(value);
}

function toOrder(row: OrderRow): Order {
  const rawItems = Array.isArray(row.items) ? row.items : [];

  return {
    id: row.id,
    number: toNumber(row.number),
    customer: {
      name: row.customer_name,
      address: row.customer_address,
      phone: row.customer_phone,
    },
    items: rawItems.map((item) => {
      const itemRecord = item as Record<string, unknown>;
      return {
        name: String(itemRecord.name),
        quantity: Number(itemRecord.quantity),
        unitPrice: Number(itemRecord.unitPrice),
        lineTotal: Number(itemRecord.lineTotal),
      };
    }),
    subtotal: toNumber(row.subtotal),
    deliveryFee:
      row.delivery_fee === null ? null : toNumber(row.delivery_fee),
    total: toNumber(row.total),
    observations: row.observations?.trim() || null,
    status: row.status,
    receivedAt: new Date(row.received_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    completedAt: row.completed_at
      ? new Date(row.completed_at).toISOString()
      : null,
  };
}

class PostgresOrderRepository implements OrderRepository {
  async create(input: CreateOrderInput) {
    const sql = getSql();
    const items = buildItems(input);
    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
    const orderId = randomUUID();
    const now = new Date().toISOString();

    const itemQueries = items.map(
      (item, itemIndex) => sql`
        INSERT INTO order_items (
          order_id, item_index, name, quantity, unit_price, line_total
        ) VALUES (
          ${orderId}, ${itemIndex}, ${item.name}, ${item.quantity},
          ${item.unitPrice}, ${item.lineTotal}
        )
      `
    );

    await sql.transaction([
      sql`
        INSERT INTO orders (
          id, customer_name, customer_address, customer_phone,
          subtotal, delivery_fee, total, status,
          observations, received_at, updated_at, completed_at
        ) VALUES (
          ${orderId}, ${input.customer.name.trim()},
          ${input.customer.address.trim()},
          ${normalizePhone(input.customer.phone)}, ${subtotal},
          ${null}, ${subtotal}, 'received',
          ${input.observations?.trim() || null}, ${now}, ${now}, ${null}
        )
      `,
      ...itemQueries,
    ]);

    return this.findById(orderId);
  }

  async list() {
    const sql = getSql();
    const rows = await sql`
      SELECT
        o.id,
        o.number,
        o.customer_name,
        o.customer_address,
        o.customer_phone,
        o.subtotal,
        o.delivery_fee,
        o.total,
        o.observations,
        o.status,
        o.received_at,
        o.updated_at,
        o.completed_at,
        COALESCE(
          json_agg(
            json_build_object(
              'name', oi.name,
              'quantity', oi.quantity,
              'unitPrice', oi.unit_price,
              'lineTotal', oi.line_total
            ) ORDER BY oi.item_index
          ) FILTER (WHERE oi.order_id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.received_at DESC
    `;

    return (rows as unknown as OrderRow[]).map(toOrder);
  }

  async update(id: string, input: UpdateOrderInput) {
    const sql = getSql();
    const currentRows = (await sql`
      SELECT id, status, delivery_fee, subtotal, completed_at
      FROM orders
      WHERE id = ${id}
    `) as unknown as CurrentOrderRow[];

    if (currentRows.length === 0) {
      throw new OrderNotFoundError("La orden no existe.");
    }

    const current = currentRows[0] as unknown as CurrentOrderRow;

    if (input.status && input.status !== current.status) {
      if (!allowedTransitions[current.status].includes(input.status)) {
        throw new InvalidOrderTransitionError(
          `No se puede cambiar una orden de ${current.status} a ${input.status}.`
        );
      }
    }

    if (
      input.deliveryFee !== undefined &&
      (current.status === "dispatched" || current.status === "rejected")
    ) {
      throw new InvalidOrderTransitionError(
        "No se puede cambiar el domicilio de una orden finalizada."
      );
    }

    const nextStatus = input.status ?? current.status;
    const currentDeliveryFee =
      current.delivery_fee === null ? null : toNumber(current.delivery_fee);
    const nextDeliveryFee = input.deliveryFee ?? currentDeliveryFee;
    const now = new Date().toISOString();
    const completedAt =
      nextStatus === "dispatched" || nextStatus === "rejected"
        ? current.completed_at ?? now
        : null;

    const updatedRows = (await sql`
      UPDATE orders
      SET
        status = ${nextStatus},
        delivery_fee = ${nextDeliveryFee},
        total = subtotal + COALESCE(${nextDeliveryFee}, 0),
        updated_at = ${now},
        completed_at = ${completedAt}
      WHERE id = ${id} AND status = ${current.status}
      RETURNING id
    `) as unknown as Array<{ id: string }>;

    if (updatedRows.length === 0) {
      throw new InvalidOrderTransitionError(
        "La orden cambió mientras se procesaba. Actualiza la pantalla e inténtalo de nuevo."
      );
    }

    return this.findById(id);
  }

  private async findById(id: string) {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        o.id,
        o.number,
        o.customer_name,
        o.customer_address,
        o.customer_phone,
        o.subtotal,
        o.delivery_fee,
        o.total,
        o.observations,
        o.status,
        o.received_at,
        o.updated_at,
        o.completed_at,
        COALESCE(
          json_agg(
            json_build_object(
              'name', oi.name,
              'quantity', oi.quantity,
              'unitPrice', oi.unit_price,
              'lineTotal', oi.line_total
            ) ORDER BY oi.item_index
          ) FILTER (WHERE oi.order_id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.id = ${id}
      GROUP BY o.id
    `) as unknown as OrderRow[];

    if (rows.length === 0) {
      throw new OrderNotFoundError("La orden no existe.");
    }

    return toOrder(rows[0] as unknown as OrderRow);
  }
}

export const orderRepository: OrderRepository = new PostgresOrderRepository();
