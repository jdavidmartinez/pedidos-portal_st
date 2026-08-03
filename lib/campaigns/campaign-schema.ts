import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value;
}

export const campaignSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    productIds: z.array(z.string().trim().min(1).max(100)).min(
      1,
      "Selecciona al menos un producto."
    ).max(50).transform((values) => Array.from(new Set(values))),
    discountPercent: z.number().int().min(1).max(100),
    startsOn: z.string().regex(datePattern, "La fecha inicial no es válida."),
    endsOn: z.string().regex(datePattern, "La fecha final no es válida."),
    active: z.boolean(),
  })
  .refine((value) => value.startsOn <= value.endsOn, {
    path: ["endsOn"],
    message: "La fecha final no puede ser anterior a la fecha inicial.",
  })
  .refine((value) => isValidDate(value.startsOn), {
    path: ["startsOn"],
    message: "La fecha inicial no es válida.",
  })
  .refine((value) => isValidDate(value.endsOn), {
    path: ["endsOn"],
    message: "La fecha final no es válida.",
  });

export type CampaignInput = z.infer<typeof campaignSchema>;
