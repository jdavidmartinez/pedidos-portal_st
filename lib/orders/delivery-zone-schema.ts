import { z } from "zod";
import { DELIVERY_ZONES } from "@/lib/orders/delivery-zones";

export const deliveryZoneConfigSchema = z.object({
  code: z.enum(DELIVERY_ZONES),
  name: z.string().trim().min(2).max(120),
  fee: z.number().int().min(0).max(1_000_000),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
});
