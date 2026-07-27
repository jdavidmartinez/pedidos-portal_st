export const ORDER_STATUSES = [
  "received",
  "accepted",
  "preparing",
  "dispatched",
  "rejected",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderCustomer {
  name: string;
  address: string;
  phone: string;
}

export interface Order {
  id: string;
  number: number;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number | null;
  total: number;
  status: OrderStatus;
  receivedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CreateOrderInput {
  customer: {
    name: string;
    address: string;
    phone: string;
  };
  items: Array<{
    name: string;
    quantity: number;
  }>;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  deliveryFee?: number;
}
