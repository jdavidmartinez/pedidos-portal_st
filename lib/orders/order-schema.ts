import { z } from "zod";
import { ORDER_STATUSES } from "@/types/order";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(240),
  phone: z.string().trim().min(7).max(24),
});

const orderItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(99),
});

export const createOrderSchema = z.object({
  customer: customerSchema,
  items: z.array(orderItemSchema).min(1).max(50),
});

export const updateOrderSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    deliveryFee: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.deliveryFee !== undefined,
    { message: "Debes enviar al menos un cambio." }
  );
