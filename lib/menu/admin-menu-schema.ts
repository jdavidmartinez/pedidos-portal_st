import { z } from "zod";

export const adminMenuProductSchema = z.object({
  categorySlug: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(1000).default(""),
  individualPrice: z.number().int().min(0),
  comboPrice: z.number().int().min(0).nullable(),
  imageUrl: z.string().trim().min(1).max(2000),
  availableQuantity: z.number().int().min(0).nullable(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
});

export type AdminMenuProductInput = z.infer<typeof adminMenuProductSchema>;
