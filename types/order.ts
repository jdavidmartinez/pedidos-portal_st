export const ORDER_STATUSES = [
  "received",
  "accepted",
  "preparing",
  "dispatched",
  "rejected",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderItemVariant = "individual" | "combo";

export interface OrderItem {
  name: string;
  variant: OrderItemVariant;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderCustomer {
  name: string;
  address: string;
  phone: string;
}

export interface OrderCampaign {
  id: string;
  name: string;
  discountPercent: number;
}

export interface Order {
  id: string;
  number: number;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  campaign: OrderCampaign | null;
  deliveryFee: number | null;
  total: number;
  observations: string | null;
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
    variant?: OrderItemVariant;
  }>;
  observations?: string;
  dataConsent: true;
  dataConsentVersion: string;
}

export interface UpdateOrderInput {
  status?: OrderStatus;
  deliveryFee?: number;
  customer?: OrderCustomer;
  items?: Array<{
    name: string;
    quantity: number;
    variant?: OrderItemVariant;
  }>;
  observations?: string | null;
  editReason?: string;
}
