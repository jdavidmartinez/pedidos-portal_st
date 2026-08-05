import { z } from "zod";
import { ORDER_STATUSES } from "@/types/order";
import { DATA_PROCESSING_POLICY_VERSION } from "@/lib/privacy/data-processing";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(240),
  phone: z.string().trim().min(7).max(24),
});

const orderItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(99),
  variant: z.enum(["individual", "combo"]).default("individual"),
});

export const createOrderSchema = z.object({
  customer: customerSchema,
  items: z.array(orderItemSchema).min(1).max(50),
  observations: z.string().trim().max(500).optional(),
  dataConsent: z.literal(true, {
    message: "Debes aceptar el tratamiento de datos personales.",
  }),
  dataConsentVersion: z.literal(DATA_PROCESSING_POLICY_VERSION),
});

export const updateOrderSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    deliveryFee: z.number().int().min(0).max(1_000_000).optional(),
    customer: customerSchema.optional(),
    items: z.array(orderItemSchema).min(1).max(50).optional(),
    observations: z.string().trim().max(500).nullable().optional(),
    editReason: z.string().trim().min(3).max(240).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.deliveryFee !== undefined ||
      value.customer !== undefined ||
      value.items !== undefined ||
      value.observations !== undefined,
    { message: "Debes enviar al menos un cambio." }
  );
