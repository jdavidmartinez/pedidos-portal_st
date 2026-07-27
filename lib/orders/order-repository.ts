import "server-only";

import { randomUUID } from "node:crypto";
import { MENU_PORTAL } from "@/app/menu/data";
import type {
  CreateOrderInput,
  Order,
  OrderItem,
  OrderStatus,
  UpdateOrderInput,
} from "@/types/order";

interface OrderStore {
  orders: Order[];
  nextNumber: number;
}

export interface OrderRepository {
  create(input: CreateOrderInput): Order;
  list(): Order[];
  update(id: string, input: UpdateOrderInput): Order;
}

export class OrderNotFoundError extends Error {}
export class InvalidOrderTransitionError extends Error {}
export class InvalidOrderItemError extends Error {}
export class InvalidCustomerPhoneError extends Error {}

const globalWithOrders = globalThis as typeof globalThis & {
  __portalOrderStore?: OrderStore;
};

const store =
  globalWithOrders.__portalOrderStore ??
  (globalWithOrders.__portalOrderStore = {
    orders: [],
    nextNumber: 1,
  });

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

class InMemoryOrderRepository implements OrderRepository {
  create(input: CreateOrderInput) {
    const items = buildItems(input);
    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
    const now = new Date().toISOString();

    const order: Order = {
      id: randomUUID(),
      number: store.nextNumber++,
      customer: {
        name: input.customer.name.trim(),
        address: input.customer.address.trim(),
        phone: normalizePhone(input.customer.phone),
      },
      items,
      subtotal,
      deliveryFee: null,
      total: subtotal,
      status: "received",
      receivedAt: now,
      updatedAt: now,
      completedAt: null,
    };

    store.orders.unshift(order);
    return structuredClone(order);
  }

  list() {
    return structuredClone(store.orders);
  }

  update(id: string, input: UpdateOrderInput) {
    const order = store.orders.find((candidate) => candidate.id === id);
    if (!order) {
      throw new OrderNotFoundError("La orden no existe.");
    }

    if (input.status && input.status !== order.status) {
      if (!allowedTransitions[order.status].includes(input.status)) {
        throw new InvalidOrderTransitionError(
          `No se puede cambiar una orden de ${order.status} a ${input.status}.`
        );
      }
      order.status = input.status;
      order.completedAt =
        input.status === "dispatched" || input.status === "rejected"
          ? new Date().toISOString()
          : null;
    }

    if (input.deliveryFee !== undefined) {
      if (order.status === "dispatched" || order.status === "rejected") {
        throw new InvalidOrderTransitionError(
          "No se puede cambiar el domicilio de una orden finalizada."
        );
      }
      order.deliveryFee = input.deliveryFee;
      order.total = order.subtotal + input.deliveryFee;
    }

    order.updatedAt = new Date().toISOString();
    return structuredClone(order);
  }
}

export const orderRepository: OrderRepository = new InMemoryOrderRepository();
